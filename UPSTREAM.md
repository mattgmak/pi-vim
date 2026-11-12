# Upstream

This repo holds one package from [justmytwospence/pi-plugins](https://github.com/justmytwospence/pi-plugins): `packages/pi-vim`.

- Fork point: upstream commit `e5e6270d3283f60570f3c6d4ab3403711a42b426`.
- Fork commit: `7dde2f7230b780714b1ec9c22ff914ea0fcfbc89`, made by `git subtree split --prefix=packages/pi-vim`.
- Branch `upstream` points at the fork commit and holds no local work.
- Branch `main` carries the local fixes on top.

## Local fixes

1. `src/index.ts`: the clipboard writer now calls pi's `copyToClipboard`. The default child-process helper cannot resolve its module in the compiled pi-bolt binary, so yank failed and the circuit breaker disabled mirroring.
2. `src/engine/modal-editor.ts`: `openLineBelow` and `openLineAbove` insert the newline through `insertTextAtCursor`. The old byte replay matched pi-copy's `ctrl+j` shortcut, so `o` opened copy mode.
3. `src/main-editor.ts` and `src/index.ts`: Normal-mode Backspace opens pi-copy's copy mode through the `copy-mode:open` event.
4. `src/main-editor.ts`: `Ctrl+U` and `Ctrl+D` scroll the transcript in Normal mode too. The upstream gate allowed Insert mode only.

## Sync with upstream

```sh
cd ~/NixConfig/vendor/justmytwospence/pi-plugins
git fetch origin main
git subtree split --prefix=packages/pi-vim -b pi-vim-split
git push git@github.com:mattgmak/pi-vim pi-vim-split:upstream --force
```

Then merge `upstream` into `main` in this repo. The shared history keeps that merge clean.
