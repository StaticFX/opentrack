<!--
	SiteFooter — real footer bookending the boot theme: brand + tagline,
	link columns, bottom bar with license and a back-to-top.
-->
<script lang="ts">
	import { ArrowUp } from '@lucide/svelte';
	import BrandGlyph from './BrandGlyph.svelte';

	const REPO = 'https://github.com/StaticFX/opentrack';
	const year = new Date().getFullYear();
</script>

<footer class="relative z-10 border-t" style="border-color:var(--ab-line)">
	<div class="mx-auto max-w-6xl px-5 py-14 sm:px-8">
		<div class="grid gap-10 sm:grid-cols-[1.3fr_1fr_1fr]">
			<div>
				<a href="/" class="focus-ring inline-flex items-center gap-2.5 rounded-md">
					<span
						class="grid size-7 place-items-center rounded-lg text-[11px] font-bold text-white"
						style="background:linear-gradient(135deg, var(--accent), color-mix(in oklab, var(--accent) 60%, white))"
					>
						OT
					</span>
					<span class="font-display text-[15px] font-semibold tracking-tight" style="color:var(--ab-text)">
						OpenTrack
					</span>
				</a>
				<p class="mt-3 max-w-xs text-[13.5px] leading-relaxed" style="color:var(--ab-text-dim)">
					The open-source issue tracker built for communities. Boards, roadmaps, upvotes, and
					changelogs — public by default.
				</p>
			</div>

			<div>
				<p class="pub-label" style="color:var(--ab-text-faint)">Product</p>
				<ul class="mt-3 space-y-2.5 text-[13.5px]">
					<li>
						<a href="/" class="transition-colors" style="color:var(--ab-text-dim)">Live demo</a>
					</li>
					<li>
						<a href="/auth/login" class="transition-colors" style="color:var(--ab-text-dim)">Sign in</a>
					</li>
					<li>
						<a href={REPO} target="_blank" rel="noopener noreferrer" class="transition-colors" style="color:var(--ab-text-dim)">
							Changelog
						</a>
					</li>
				</ul>
			</div>

			<div>
				<p class="pub-label" style="color:var(--ab-text-faint)">Resources</p>
				<ul class="mt-3 space-y-2.5 text-[13.5px]">
					<li>
						<a href={REPO} target="_blank" rel="noopener noreferrer" class="transition-colors" style="color:var(--ab-text-dim)">
							Source code
						</a>
					</li>
					<li>
						<a href={`${REPO}#readme`} target="_blank" rel="noopener noreferrer" class="transition-colors" style="color:var(--ab-text-dim)">
							Self-host guide
						</a>
					</li>
					<li>
						<a href={`${REPO}/issues`} target="_blank" rel="noopener noreferrer" class="transition-colors" style="color:var(--ab-text-dim)">
							Report an issue
						</a>
					</li>
				</ul>
			</div>
		</div>

		<div class="mt-12 flex flex-wrap items-center justify-between gap-4 border-t pt-6" style="border-color:var(--ab-line)">
			<p class="data-mono" style="color:var(--ab-text-faint)">© {year} OpenTrack · MIT licensed · built in the open</p>
			<div class="flex items-center gap-4">
				<a
					href={REPO}
					target="_blank"
					rel="noopener noreferrer"
					class="focus-ring flex items-center gap-1.5 rounded-md text-[13px] transition-colors"
					style="color:var(--ab-text-dim)"
				>
					<BrandGlyph provider="github" size={14} /> GitHub
				</a>
				<a href="#top" class="focus-ring flex items-center gap-1.5 rounded-md text-[13px] transition-colors" style="color:var(--ab-text-dim)">
					Back to top <ArrowUp size={13} />
				</a>
			</div>
		</div>
	</div>
</footer>

<style>
	footer a:hover {
		color: var(--ab-text);
	}
</style>
