import { Link } from '@tanstack/react-router';

export function NotFoundPage() {
	return (
		<div className="flex flex-col gap-3 font-mono">
			<div>
				<span className="text-highlight">error:</span> route not found
			</div>
			<div className="text-text-dim text-sm">the path you requested does not resolve to a component.</div>
			<Link to="/" className="text-accent hover:underline">
				← cd ~
			</Link>
		</div>
	);
}
