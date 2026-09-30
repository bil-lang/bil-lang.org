# How it works

The same three-role shape as Example 10 (`origin`/`relay`/`reflect`), narrowed to just row 0 and renamed `controller`/`relay`/`rowEnd`, plus a fourth role, `idle`, for every processor off that row. The placement here brings in a second dimension to the wildcards.

| Role | Position | Behavior |
|---|---|---|
| controller | (0, 0) | originates each round's value east, waits for it to come back reflected |
| relay | (0, middle columns) | forwards a value east, then forwards its reflection back west |
| rowEnd | (0, last column) | receives from the west, reflects straight back |
| idle | every other row | nothing to do — just confirms placement dispatched correctly |

