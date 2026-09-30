# How it works

It's a tiny (untrained, illustrative) transformer language model — embedding → self-attention → feed-forward → output projection — running for real across a grid of isolated Web Worker processes, each linked only to its N/E/S/W neighbours. Rather than one processor doing all the math (as Example 21 did), the model's four stages are spread across four rows of the grid, and each column carries one token position through the pipeline.

Chunk by column, pipeline by row:

| Row | Stage | Communication |
|---|---|---|
| 0 | Embed + positional encoding | none — per-token, fully local |
| 1 | Self-attention + residual | needs every column's data |
| 2 | Feed-forward + residual | none — per-token, fully local |
| 3 | Output projection + argmax | none — per-token, fully local |

A token's vector representation flows south, row to row, over the grid's genuine blocking links (each send/receive is a real rendezvous between two Worker threads, not a shared-memory call).

Why only row 1 talks sideways: attention is the one operation where a token's output depends on every other token, not just itself — so row 1's columns gather each other's vectors west/east (the controller/relay/row-end idiom from Example 21, generalized to carry whole vectors instead of single numbers), compute attention centrally, then scatter the results back before sending south. Rows 0, 2, and 3 need no lateral communication at all, so every column computes its slice fully in parallel, on its own real thread.

Where the parallelism comes from:

1. Column-parallel — within rows 0/2/3, all columns run simultaneously (3 of 4 stages are "embarrassingly parallel").
2. Pipelined — because links never buffer, row 0 doesn't wait for the whole model to finish before starting the next token chunk; it just waits for row 1 to be ready. So multiple generations are in flight across the four rows at once, like a hardware pipeline — throughput is limited only by the slowest stage (attention, the only one with cross-column hops).

The screen shows this happening live: row 0 racing ahead on later generations while row 1 is still working through gather/attend/scatter for an earlier one, and predictions surfacing at row 3 once their vector has passed through all four stages.
