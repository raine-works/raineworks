<script lang="ts">
    import { client } from "$lib/api.client";

</script>

<div>
    <button on:click={async () => {
        await client.user.test.post({ name: 'Raine' })
    }} >Click Me</button>
</div>