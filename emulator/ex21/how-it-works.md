# How it works

The exact same `controller`/`relay`/`rowEnd`/`idle` placement as Example 20, and the exact same relay idiom — but this time what's hopping across row 0 isn't a single reflected counter, it's a whole row's worth of input tokens gathered in to the controller, and that many predicted tokens scattered back out. All the transformer math runs on one processor, the controller, exactly like Example 20's "controller does the real logic, everyone else relays" split — what's new is that a genuinely useful payload (a sequence of embeddings, not a scalar) is what's being relayed.

| Phase | Direction | What travels |
|---|---|---|
| Gather | west, column by column | each column's own token, one hop at a time |
| Attend | on the controller only | embed + positional encoding, self-attention over the whole row, residual, feed-forward, residual, output projection, argmax |
| Scatter | east, column by column | each column's predicted token, walking the same relay chain forwards |

Gather takes exactly `cols-1` fully-drained rounds: on round `r`, whichever column *is* `r` sends its own token west, every column further west forwards it one more hop, and everyone east of `r` does nothing that round — one column's token completing its walk to the controller per round. Only once the whole row has arrived does the controller run one full transformer pass and get back one predicted token per column; scatter is the mirror image, walking the same chain forwards.

The embedding, attention and feed-forward weights are fixed, hand-picked numbers, not a trained model — but real embeddings and real attention scores really do cross links, one `int` at a time. The point is the architecture, and the fact that it runs for real, distributed across the mesh's own link fabric — not the quality of what gets predicted.
