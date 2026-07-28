<script lang="ts">
	import { liveMessage } from '$lib/announce';
</script>

<div aria-live="polite" role="status" class="sr-only">{$liveMessage}</div>
