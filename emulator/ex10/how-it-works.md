# How it works

Three roles are distributed across every row: `origin` at column 0, `reflect` at the last column, `relay` everywhere in between. The ripple is independent on every row. The process placement is done via wildcards `(*, 0)`, `(*, cols-1)` and `(*,*)`.

| Role | Position | Behavior |
|---|---|---|
| origin | column 0 | sends each wave east, then waits for its own reflection to come back |
| relay | every middle column | forwards a wave east, then forwards its reflection back west |
| reflect | last column | receives a wave from the west, sends it straight back |

A wave is just a plain int (0, 1, 2 — three per row), and it only exists as far as it's actually travelled: `origin` sends it, every `relay` column forwards it one hop at a time over the grid's links, `reflect` turns it around. `origin` blocks on its own reflection before sending the next wave, so a row's three waves happen strictly one after another. There's no pipelining here, on purpose. This demo shows the Bil substrate: real isolation, blocking links between real processes.