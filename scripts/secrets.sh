#!/usr/bin/env bash
# Each package's .env.local (or .env.test under NODE_ENV=test) from its .env.example: every key the example has, its
# value the one already in the target file if there is one (so what you set by hand survives a re-run), else the
# example's. Keys only the old file has are kept, at the end. Run by `bun run dev:init` (scripts/init.sh).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGES_DIR="${ROOT_DIR}/packages"
NODE_ENV_VALUE="${NODE_ENV:-development}"

if [[ "${NODE_ENV_VALUE}" == "test" ]]; then
	TARGET_ENV_FILE=".env.test"
else
	TARGET_ENV_FILE=".env.local"
fi

if [[ ! -d "${PACKAGES_DIR}" ]]; then
	echo "packages directory not found at ${PACKAGES_DIR}" >&2
	exit 1
fi

# The env file being written, removed if the script stops part way (it's moved into place once done).
TEMP_OUTPUT=""
trap 'rm -f "${TEMP_OUTPUT}"' EXIT

trim() {
	local value="$1"
	value="${value#"${value%%[![:space:]]*}"}"
	value="${value%"${value##*[![:space:]]}"}"
	printf '%s' "${value}"
}

lookup_key_in_dotenv_payload() {
	local payload="$1"
	local target_key="$2"
	local line

	while IFS= read -r line || [[ -n "${line}" ]]; do
		if [[ "${line}" =~ ^[[:space:]]*# ]] || [[ -z "$(trim "${line}")" ]]; then
			continue
		fi

		if [[ "${line}" =~ ^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=(.*)$ ]]; then
			local parsed_key="${BASH_REMATCH[2]}"
			if [[ "${parsed_key}" == "${target_key}" ]]; then
				printf '%s' "${BASH_REMATCH[3]}"
				return 0
			fi
		fi
	done <<< "${payload}"

	return 1
}

# A value as written to the env file: always in double quotes. Already double-quoted stays as is; single quotes
# become double; a bare value is wrapped as written (process.loadEnvFile doesn't unescape \\ or \", so nothing is
# escaped), unless it holds a double quote, which can't be wrapped and is left bare.
quote_env_value() {
	local value
	value="$(trim "$1")"
	if [[ "${value}" =~ ^\".*\"$ ]]; then
		printf '%s' "${value}"
	elif [[ "${value}" =~ ^\'(.*)\'$ ]] && [[ "${BASH_REMATCH[1]}" != *\"* ]]; then
		printf '"%s"' "${BASH_REMATCH[1]}"
	elif [[ "${value}" == *\"* ]]; then
		printf '%s' "${value}"
	else
		printf '"%s"' "${value}"
	fi
}

process_env_example() {
	local example_file="$1"
	local package_dir
	package_dir="$(dirname "${example_file}")"
	local output_file="${package_dir}/${TARGET_ENV_FILE}"

	local temp_output
	temp_output="$(mktemp)"
	TEMP_OUTPUT="${temp_output}"

	# Values already in the target file win, so keys entered by hand survive a re-run.
	# Delete a line (or the file) to have it filled from .env.example again.
	local existing=""
	if [[ -f "${output_file}" ]]; then
		existing="$(cat "${output_file}")"
	fi
	local seen_keys="|"

	local line
	while IFS= read -r line || [[ -n "${line}" ]]; do
		if [[ "${line}" =~ ^[[:space:]]*# ]] || [[ -z "$(trim "${line}")" ]]; then
			printf '%s\n' "${line}" >> "${temp_output}"
			continue
		fi

		if [[ "${line}" =~ ^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=(.*)$ ]]; then
			local export_prefix="${BASH_REMATCH[1]}"
			local env_key="${BASH_REMATCH[2]}"
			local raw_value="${BASH_REMATCH[3]}"
			local trimmed_value
			local output_key="${env_key}"
			trimmed_value="$(trim "${raw_value}")"
			seen_keys="${seen_keys}${output_key}|"

			local existing_value=""
			# Blank, `""` and `''` all count as not set.
			if existing_value="$(lookup_key_in_dotenv_payload "${existing}" "${output_key}")" \
				&& [[ ! "$(trim "${existing_value}")" =~ ^(\"\"|\'\')?$ ]]; then
				printf '%s%s=%s\n' "${export_prefix}" "${output_key}" "$(quote_env_value "${existing_value}")" >> "${temp_output}"
				continue
			fi

			if [[ -n "${trimmed_value}" ]]; then
				printf '%s%s=%s\n' "${export_prefix}" "${output_key}" "$(quote_env_value "${raw_value}")" >> "${temp_output}"
				continue
			fi

			printf '%s%s=""\n' "${export_prefix}" "${output_key}" >> "${temp_output}"
			continue
		fi

		printf '%s\n' "${line}" >> "${temp_output}"
	done < "${example_file}"

	# Keys in the old file that .env.example doesn't have are kept too, at the end.
	local kept_header=false
	while IFS= read -r line || [[ -n "${line}" ]]; do
		if [[ "${line}" =~ ^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=(.*)$ ]]; then
			local kept_prefix="${BASH_REMATCH[1]}"
			local kept_key="${BASH_REMATCH[2]}"
			local kept_value="${BASH_REMATCH[3]}"
			case "${seen_keys}" in
				*"|${kept_key}|"*) continue ;;
			esac
			seen_keys="${seen_keys}${kept_key}|"
			if [[ "${kept_header}" != "true" ]]; then
				printf '\n# Kept from the previous %s (not in .env.example)\n' "${TARGET_ENV_FILE}" >> "${temp_output}"
				kept_header=true
			fi
			printf '%s%s=%s\n' "${kept_prefix}" "${kept_key}" "$(quote_env_value "${kept_value}")" >> "${temp_output}"
		fi
	done <<< "${existing}"

	mv "${temp_output}" "${output_file}"
	echo "Generated ${output_file}"
}

found_example=false
while IFS= read -r example_file; do
	found_example=true
	process_env_example "${example_file}"
done < <(find "${PACKAGES_DIR}" -type f -name ".env.example" | sort)

if [[ "${found_example}" != "true" ]]; then
	echo "No .env.example files found under ${PACKAGES_DIR}" >&2
	exit 1
fi