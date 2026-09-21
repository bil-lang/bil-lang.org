---
title: "Rethinking Classical Concurrency Patterns — the Bil Edition"
excerpt_separator: "<!--more-->"
categories:
  - Blog
tags:
  - concurrency
  - CSP
  - occam
  - Go
---

<a id="top"></a>

This is a rewrite of Bryan C. Mills' [GopherCon 2018 talk](https://youtu.be/5zXAHh5tJqQ), organized pattern-by-pattern rather than slide-by-slide. For each pattern the talk discusses in Go, this version shows how it looks in [Bil](https://github.com/bil-lang/bil) — a variant of Go, built on the Go toolchain, that replaces goroutines-plus-buffered-channels with an occam-style Communicating Sequential Parallel model (`par`/`seq`/`alt`/`proc`, always-unbuffered channels, no `go` keyword) — and calls out the pros and cons of the Bil version against the original.

The talk's own thesis is two rules, repeated at the start, middle, and end of the deck: **"Start goroutines when you have concurrent work"** and **"Share by communicating."** Bil's whole premise is taking those same two rules and making them compiler-enforced instead of idiomatic advice — there's no `go` statement to reach for out of habit, and the static checker rejects code that shares memory across `par` branches instead of trusting the author to have read the blog post. That's the thread running through every comparison below.

<!--more-->

---

## Summary

| Pattern | Bil verdict | Why |
|---|---|---|
| [Asynchronous callbacks](#pattern-1) | Structurally impossible (a good thing) | `par` always joins before returning |
| [Futures](#pattern-2) | Clean, near 1:1 | `par` branches are already "start work, retrieve later" |
| [Producer–consumer queue](#pattern-3) | Clean, near 1:1 | Unbuffered chan + `close`/`range` needs no translation |
| [Condition variables](#pattern-4) | Replaced, mostly for the better | 3 of 4 named failure modes gone structurally; starvation needs opt-in `pri alt` |
| [Semaphores / resource limits](#pattern-5) | Ports, but heavier | No buffered-channel-as-counter trick; needs an explicit process |
| [Broadcast / fan-out](#pattern-6) | Excluded by design | `alt` is input-guard-only, so that no primitive resolves choice on both ends at once |
| [Worker pools (fixed N)](#pattern-7) | Clean, `WaitGroup`-free | Replicated `par` shares one channel legally; join is automatic |
| [Worker pools (dynamic `errgroup`-style cancel-all)](#pattern-7) | Ports with real extra cost | Needs one cancel channel per worker |

[⇧ top](#top)

---

<a id="pattern-1"></a>

## Pattern 1: Asynchronous callbacks (the rejected pattern)

Original (Go) — presented in the talk as the pattern to avoid:

```go
// Fetch immediately returns, then fetches the item and
// invokes f in a goroutine when the item is available.
// If the item does not exist,
// Fetch invokes f on the zero Item.
func Fetch(name string, f func(Item)) {
    go func() {
        […]
        f(item)
    }()
}
```

> This is not how we write Go. (You likely know that already.)

**The Bil take:** this pattern isn't just discouraged in Bil, it's inexpressible. There is no `go` keyword — the only way to introduce concurrency is `par`, and a `par` block never returns control to its enclosing code until every branch has finished (fork *and* join, always). A `Fetch` written as a `proc` can't launch background work and return before that work completes, because entering a `par` inside `Fetch` would just block `Fetch` itself until that `par` joins. So the "fire a goroutine, call back later, caller never synchronizes with it" shape doesn't have a Bil translation — you're routed straight to a Future or a queue, which is exactly what the rest of the talk argues for anyway.

**Pros vs. original:** the bad pattern can't be written by accident; there's no footgun to avoid because there's no gun. **Cons:** none, really — this is Bil structurally agreeing with the talk. It's worth naming as its own point mostly because it shows Bil isn't just "Go with stricter linting" — some things Go merely discourages, Bil's grammar rules out.

[⇧ top](#top)

---

<a id="pattern-2"></a>

## Pattern 2: Futures

Original (Go):

```go
// Fetch immediately returns a channel, then fetches
// the requested item and sends it on the channel.
// If the item does not exist,
// Fetch closes the channel without sending.
func Fetch(name string) <-chan Item {
    c := make(chan Item, 1)
    go func() {
        […]
        c <- item
    }()
    return c
}
```

```go
a := Fetch("a")
b := Fetch("b")
consume(<-a, <-b)
```

> The Go analogue to a Future is a single-element buffered channel. To use Futures for concurrency, the caller must set up concurrent work before retrieving results.

Bil:

```go
package main

proc fetch(id int, out chan<- int) {
    out <- id * 10
}

func main() {
    ac := make(chan int)
    bc := make(chan int)

    par {
        fetch(1, ac)
        fetch(2, bc)
        seq {
            var a, b int
            ac -> a
            bc -> b
            println(a, b)
        }
    }
}
```

**Pros vs. original:** the buffered-channel-as-single-shot-future trick disappears entirely, because it's no longer needed — `fetch(1, ac)` and `fetch(2, bc)` run as sibling `par` branches, so the "start both, then read both" call-site shape from the talk's `Yes:` example is the *only* shape `par` offers you. The talk spends a whole slide (`Caller-side ambiguity`) warning that `a := <-Fetch("a")` is a foot-gun because it silently serializes what looked concurrent; in Bil that mistake isn't just discouraged, it's a different, more verbose thing to write (you'd have to move the receive inside its own `seq` branch and manually break the parallelism), so it reads as deliberate rather than an easy slip. **Cons:** Go's version is a one-liner return type (`<-chan Item`) that composes with anything — store it, pass it around, fan it into a `select`. Bil's channel is tied to a specific `proc` call inside a specific `par`; there's no equivalent of stashing a "pending future" value in a struct field and resolving it later from unrelated code, since a channel's reader and writer are fixed at the point the `par` is written, not assembled dynamically at runtime.

[⇧ top](#top)

---

<a id="pattern-3"></a>

## Pattern 3: Producer–consumer queues

Original (Go):

```go
// Glob finds all items with names matching pattern
// and sends them on the returned channel.
// It closes the channel when all items have been sent.
func Glob(pattern string) <-chan Item {
    c := make(chan Item)
    go func() {
        defer close(c)
        for […] {
            […]
            c <- item
        }
    }()
    return c
}
```

```go
for item := range Glob("[ab]*") {
    […]
}
```

> A channel fed by one goroutine and read by another acts as a queue. The consumer of a producer–consumer queue is usually a range-loop.

Bil:

```go
package main

const n = 5

proc glob(out chan<- int) {
    for i := range n {
        out <- i + 1
    }
    close(out)
}

func main() {
    items := make(chan int)
    par {
        glob(items)
        seq {
            for item := range items {
                println(item)
            }
        }
    }
}
```

**Pros vs. original:** this is the single closest match in the whole comparison — one producer proc, one consumer branch, `close`-to-signal-end, `range` to drain — because Go's unbuffered-producer/single-consumer queue was already exactly the rendezvous shape Bil enforces everywhere. The `sync.Mutex`/shared-slice implementation the talk contrasts this with (the `Queue` type with `sync.Cond`, discussed next) simply has no Bil equivalent to reach for by mistake — there's no shared mutable `items []Item` to protect, because the channel *is* the queue. **Cons:** Go's `Glob` can be buffered (`make(chan Item, N)`) to decouple producer and consumer rates a little; Bil's channel is always unbuffered, so a fast producer genuinely blocks on a slow consumer with zero slack. If you need slack, Bil pushes you toward Example 11 in the guide — a dedicated `buffer` process holding an internal `[]int` behind a guarded `alt`, which is more code than `make(chan Item, N)` but makes the buffering an explicit, visible process in the topology rather than a hidden channel property.

[⇧ top](#top)

---

<a id="pattern-4"></a>

## Pattern 4: Condition variables, and why the talk moves away from them

The talk builds a `Queue` guarded by a `sync.Mutex` + `sync.Cond`:

```go
type Queue struct {
    mu sync.Mutex
    items []Item
    itemAdded sync.Cond
}

func (q *Queue) Get() Item {
    q.mu.Lock()
    defer q.mu.Unlock()
    for len(q.items) == 0 {
        q.itemAdded.Wait()
    }
    item := q.items[0]
    q.items = q.items[1:]
    return item
}

func (q *Queue) Put(item Item) {
    q.mu.Lock()
    defer q.mu.Unlock()
    q.items = append(q.items, item)
    q.itemAdded.Signal()
}
```

> Wait atomically unlocks the mutex and suspends the goroutine. Signal locks the mutex and wakes up the goroutine.

...then names four specific failure modes that motivate abandoning this style: **spurious wakeups**, **forgotten signals**, **starvation**, and **unresponsive cancellation**. There is no Bil translation of `sync.Cond` at all — `sync.Mutex`/`sync.Cond` aren't part of the model, so this pattern doesn't get ported, it gets replaced by the buffer-process/`alt` idiom (Example 11 from the Bil guide):

```go
package main

const capacity = 2
const total = 7

proc buffer(in <-chan int, request <-chan int, out chan<- int) {
    var queue []int
    var v int
    var emitted = 0

    for emitted < total {
        alt {
            (len(queue) < capacity) && in -> v {
                queue = append(queue, v)
            }
            (len(queue) > 0) && request -> _ {
                out <- queue[0]
                queue = queue[1:]
                emitted++
            }
        }
    }
}
```

It's worth checking the four failure modes against this one at a time, since they're the whole reason the talk moves off condition variables:

- **Spurious wakeups** — Go's `for len(q.items) == 0 { q.itemAdded.Wait() }` needs the `for` because `Wait()` can return without anything actually having changed. Bil's `alt` guard `(len(queue) < capacity) && in -> v` is re-evaluated fresh every time the surrounding `for` loop reaches it; there's no separate "wake up, then go check" step to desynchronize from the actual condition, because the guard *is* the condition, checked at the moment of the (still synchronous) rendezvous.
- **Forgotten signals** — in Go, a `Put` that calls `Signal()` before any goroutine is inside `Wait()` loses that wakeup, which is exactly why `Wait()` has to sit in a re-checking loop rather than a one-shot `if`. Bil has no separate signal event to lose in the first place: an early `in <- v` from a producer just blocks until `buffer`'s `alt` loop comes back around to that guard — nothing is "sent into the void" the way a `Signal()` can be.
- **Starvation** — this one Bil does *not* solve for free. A plain `alt` desugars to Go's own `select`, and `select` is documented as picking pseudo-randomly among ready cases — the guide's own Example 9 confirms this empirically (plain `alt` between a `high` and `low` sender came back `low`×5 then `high`×5 in one run, the opposite of any priority). What Bil adds is `pri alt`, a documented, compiler-supported way to force priority ordering instead of leaving it to chance — the same example shows `pri alt` giving `high`×5 then `low`×5, 5/5 runs. Go's `sync.Cond` has no equivalent knob at all.
- **Unresponsive cancellation** — the talk's fix in Go is threading a `context.Context` through a `select`. Bil's fix is the same shape: a cancel channel is just another `alt` guard, no different from any other. Validated directly — adding a `cancel <-chan int` branch to a semaphore-style `alt` and sending on it from a sibling `seq` branch after a short sleep terminates the pool process cleanly and exits, exactly like the `ctx.Done()` case in Go's `select`.

**Pros vs. original:** three of the four named failure modes (spurious wakeups, forgotten signals, unresponsive cancellation) go away structurally rather than by discipline — there's no mutex/condvar pair to get subtly wrong, because the rendezvous itself carries the synchronization. **Cons:** starvation is not solved by default, only solvable — you have to notice you need `pri alt` and reach for it; a `sync.Cond`-based Go program has the same exposure and the same lack of a built-in fix, so this is closer to a wash than a Bil win, just a differently-shaped one (an explicit opt-in primitive vs. no primitive at all). More generally: the buffer-process idiom is more lines than the mutex/condvar version for the same capacity-2 queue — Bil trades line count for removing an entire class of memory-sharing bug.

[⇧ top](#top)

---

<a id="pattern-5"></a>

## Pattern 5: Resource limits as resources (semaphores)

The talk's Go progression goes from a `sync.Cond`-guarded pool, to "resource limits are resources too," to a buffered channel used as a semaphore, with cancellation added via `select`:

```go
func (p *Pool) Acquire(ctx context.Context) (net.Conn, error) {
    select {
    case conn := <-p.idle:
        return conn, nil
    case p.sem <- token{}:
        conn, err := dial()
        if err != nil {
            <-p.sem
        }
        return conn, err
    case <-ctx.Done():
        return nil, ctx.Err()
    }
}
```

> When we block on communicating, others can also communicate with us: for example, to cancel the call.

Bil has its own dedicated worked example for exactly this — Example 16 in the guide, a P/V semaphore process built from `alt` guards over per-client channels:

```go
proc semaphore(chans []chan bool) {
    count := maxCount
    held := make([]bool, nClients)
    for range nClients * cycles * 2 {
        alt i := range nClients {
            (held[i] || count > 0) && chans[i] -> _ {
                if held[i] {
                    held[i] = false
                    count++
                } else {
                    held[i] = true
                    count--
                }
            }
        }
    }
}
```

and adding cancellation to a similar pool follows the same pattern as any other `alt`, validated directly:

```go
proc pool(acquire <-chan int, release <-chan int, cancel <-chan int) {
    held := 0
    for {
        alt {
            (held < limit) && acquire -> _ {
                held++
            }
            (held > 0) && release -> _ {
                held--
            }
            cancel -> _ {
                return
            }
        }
    }
}
```

**Pros vs. original:** Go's version quietly relies on `p.sem <- token{}` succeeding *because* the channel is buffered — the buffer capacity *is* the semaphore count, which is elegant but means the semaphore's whole state lives inside a channel's internal buffer, invisible to anyone reading the type. Bil's semaphore is a real, visible process (Example 16's `semaphore` proc) with an explicit `count`/`held` — you can read the state machine directly instead of inferring it from a buffer capacity. The cancellation guard costs nothing extra beyond one more `alt` arm, same as Go's `select`. **Cons:** Bil's version needs a full dedicated process plus one channel *per client* (`chans []chan bool`), because there's no buffered channel to lean on as a free counting primitive — Go gets a counting semaphore in three lines (`make(chan token, limit)`); Bil needs a proc, an array of channels, and explicit bookkeeping. The convenience of "buffer capacity as a data structure" is exactly the thing Bil's "always unbuffered" rule gives up.

[⇧ top](#top)

---

<a id="pattern-6"></a>

## Pattern 6: Broadcast / fan-out completion — a deliberate exclusion, not a gap

The talk's `Idler` uses `Broadcast()` (and, in the channel-based version, `close(idle)`) so that an arbitrary, unknown-in-advance number of callers can all wake up on one event:

```go
func (i *Idler) SetBusy(b bool) {
    idle := <-i.next
    if b && (idle == nil) {
        idle = make(chan struct{})
    } else if !b && (idle != nil) {
        close(idle) // Idle now.
        idle = nil
    }
    i.next <- idle
}
```

> Broadcast usually communicates events that affect all waiters.

This is the one pattern that does **not** port as a direct translation. Bil enforces that a channel is read in at most one `par` branch. In Bil, `alt` only supports input guards — there's no way to guard on 'is anyone ready to receive from me,' so a buffer can't offer output the same way it offers input.

_Why?_

An input guard's readiness is a local, one-hop fact: "is this guard ready?" only ever depends on whether one specific process is currently trying to send — no negotiation needed, just a check. An output guard's readiness isn't local in the same way: if a process could `alt` over several possible *sends*, whether any one of them is ready depends on whether the receiver on the other end is itself, right now, willing to commit to that specific pairing — and if that receiver is also running an `alt` choosing among several potential senders, neither side can resolve its own readiness without first knowing the other side's still-undetermined choice. That circular dependency is the same shape as the classic distributed matching/commitment problem, and resolving it for real needs an actual protocol (propose, acknowledge, commit, or similar) — at which point different, individually reasonable protocol choices (who proposes first, how retries or ties are broken, whether backoff is randomized) can produce different livelock or deadlock behavior for the exact same program. The deadlock outcome becomes a property of the matching implementation rather than of the program's CSP semantics — precisely "implementation specific deadlock conditions." Go's own `select` *does* support output guards (`case ch <- v:`), but only gets away with it because it isn't actually distributed: every channel named in one `select` is resolved against a single runtime's one global scheduler lock, in one address space. That's exactly the shared-memory assumption Bil's whole placement story — processes with no shared memory, safely movable onto physically separate processors — is built to not need, so a primitive that needs a global arbiter to stay safe doesn't fit.

**The solution:** give every waiter its own channel and have the event source hold one channel per waiter, so the "broadcast" becomes `N` ordinary point-to-point sends — legal Bil, but only if the set of waiters is a fixed, known-in-advance `N` (so both sides can be expressed with `par i := range N`, folding back into the replicated case that *is* allowed) rather than a genuinely dynamic registry of callers arriving at arbitrary times, which the talk's `Idler.AwaitIdle` explicitly supports and Bil has no equivalent primitive for. One sender, `N` receivers:

```go
package main

const n = 3

proc waiter(id int, done <-chan int) {
    done -> _
    println("waiter", id, "done")
}

proc broadcaster(chans []chan int) {
    par i := range n {
        chans[i] <- 0
    }
}

func main() {
    chans := makeChans[int](n)
    par {
        broadcaster(chans)
        par i := range n {
            waiter(i, chans[i])
        }
    }
}
```

`broadcaster` is a single `proc` — one logical sender, matching the shape of the original `Idler` — but its body is itself a *replicated* `par i := range n { chans[i] <- 0 }`, so the `n` individual sends fire concurrently rather than being forced into program order by a sequential loop; each is still exactly one writer (`broadcaster`'s replica `i`) paired with exactly one reader (`waiter`'s replica `i`) on `chans[i]`, so it satisfies the same one-reader-one-writer rule as everything else in this document, just `n` times over instead of once.

**Pros vs. original:** this is the price of a guarantee, not an oversight — restricting `alt` to input guards is what keeps every synchronization event in a Bil program one-sided (at most one party ever making a nondeterministic choice), and that's exactly what makes the static checks, and the deadlock-freedom-by-construction and safe-placement-onto-disjoint-processors story, tractable in the first place. Admitting output guards to close this gap would mean admitting the distributed matching problem above right back in. **Cons:** the mechanical cost is real regardless of why it exists — Go's `close(ch)` gives every current and future receiver of that channel a simultaneous, race-free wakeup for free, and that "future receiver" part (a goroutine that hasn't even called `AwaitIdle` yet when `SetBusy(false)` runs) is precisely what Bil's static, fixed-at-compile-time topology can't express.

[⇧ top](#top)

---

<a id="pattern-7"></a>

## Pattern 7: Worker pools

The talk runs through four Go variants: a shared-queue pool, the same pool with `sync.WaitGroup` cleanup, a semaphore-channel "inverted" pool, and (in the backup slides) `errgroup.WithContext` with `SetLimit`. Take the classic shared-queue version:

```go
work := make(chan Task)
for n := limit; n > 0; n-- {
    go func() {
        for task := range work {
            perform(task)
        }
    }()
}
```

```go
for _, task := range hugeSlice {
    work <- task
}
close(work)
wg.Wait()
```

Bil:

```go
package main

const limit = 3
const total = 9
const done = -1

proc worker(id int, work <-chan int) {
    var task int
    for {
        work -> task
        if task == done {
            return
        }
        println(id, task)
    }
}

func main() {
    work := make(chan int)
    par {
        par i := range limit {
            worker(i, work)
        }
        seq {
            for t := range total {
                work <- t
            }
            for range limit {
                work <- done
            }
        }
    }
}
```

**Pros vs. original:** the `sync.WaitGroup` disappears entirely — `par`'s own join already waits for every one of the `limit` replicated `worker` instances to return, which is exactly what `wg.Wait()` was doing by hand. `close(work)` still works as the shutdown signal in the sense that Go code does, but note the actual example above uses an explicit sentinel (`done = -1`) instead, matching the guide's own idiom (Example 15's poison pill) — worth trying `close`+`range` here too, since Pattern 3 confirmed both are legal Bil; either shuts the pool down cleanly. Either way, the pool's whole lifecycle — start, dispatch, shut down, join — is shorter in Bil than the talk's "cleaning up" slide, precisely because `par` folds the `WaitGroup` bookkeeping in for free. **Cons:** `errgroup.WithContext(ctx)` with `SetLimit` and "cancel every worker on the first error" doesn't have a clean Bil equivalent, for the same reason as Pattern 6 — propagating one cancellation to `limit` already-running workers is a fixed-N fan-out (doable: give each worker its own cancel channel, loop sending to each), but there's no single primitive that does it in one call the way closing `ctx`'s internal channel does in Go. And the dynamic, escape-time-varies-per-item load balancing the guide's own Mandelbrot example (`farmer`/`worker` with per-worker `assign`/`result` channels and an `alt w := range nWorkers` collecting whichever result is ready first) needs an explicit dispatcher process and one channel pair *per worker* — more moving parts than `errgroup`'s implicit shared queue, in exchange for a topology you can read straight off the source rather than infer from a library's internals.

[⇧ top](#top)

---

## Closing thoughts

The overall shape: patterns that were already "one sender, one receiver, synchronous" in Go (futures, simple queues, semaphores, fixed-size pools) translate to Bil with little or no ceremony, because that was already the shape Bil's rendezvous model wants. Patterns that lean on Go's channels being able to have an *arbitrary, dynamic* number of readers (`close`-to-broadcast, `errgroup`'s implicit shared cancellation) are exactly where Bil's static, compiler-checked topology pushes back — not a bug, but a direct consequence of the same design that makes Bil's processes safely placeable on physically separate processors with no shared memory (per `docs/guide.md`'s stated purpose), which is a guarantee Go's dynamic channel plumbing can't offer at all.

[⇧ top](#top)
