Bil concurrency distilled

_This post was heavily inspired by [Go concurrency distilled](https://antonz.org/go-concurrency-distilled/) by [Anton Zhiyanov] which I highly recommend as pre-reading as a refresher for baseline Go concurrency, before studying Bil. I have used AI heavily._

Bil is Go with a different answer to one question:

What if concurrency were part of the language instead of a library convention?

Bil keeps Go’s types, structs, generics, control flow, and standard library. What changes is the concurrency model: par, alt, proc, seq, skip, and stop provide a small CSP/occam-inspired vocabulary for expressing concurrent programs. (GitHub)

If you know Go, most of Bil looks familiar.

The interesting part is everything that happens when two pieces of code need to run at the same time.

⸻

Running things concurrently

In Go, you start a goroutine with go:

go worker()

Bil doesn’t have go.

Instead, concurrency is expressed explicitly with par:

par {
    worker()
    worker()
}

Both processes run concurrently, and the par block completes only when both have completed.

For example:

package main
proc hello(name string) {
    println("hello", name)
}
func main() {
    par {
        hello("alice")
        hello("bob")
    }
    println("done")
}

The two calls can execute concurrently.

done cannot be printed until both calls have finished.

This is the basic Bil concurrency operation:

       ┌── worker("alice") ──┐
main ──┤                     ├── done
       └── worker("bob") ────┘

There is no goroutine handle to keep track of and no WaitGroup required for this simple fork/join case.

⸻

proc

Bil introduces proc as the name for a process function:

proc worker(id int) {
    println("worker", id)
}

It behaves like a Go function for ordinary language purposes.

The important difference is semantic: a proc is intended to participate in Bil’s process-oriented concurrency model.

A process can communicate with another process through channels.

⸻

Channels

A Bil channel is an unbuffered communication channel:

c := make(chan int)

Unlike Go, buffered channels are not part of Bil’s concurrency model. A Bil channel represents a rendezvous between a sender and a receiver. (GitHub)

A sender writes using ordinary Go channel syntax:

c <- 42

A receiver can use Bil’s left-to-right receive syntax:

var x int
c -> x

The latter means the same thing as:

x = <-c

The Bil form makes communication read naturally as:

channel -> variable

For example:

proc sender(c chan<- int) {
    c <- 42
}
proc receiver(c <-chan int) {
    var x int
    c -> x
    println(x)
}
func main() {
    c := make(chan int)
    par {
        sender(c)
        receiver(c)
    }
}

The sender cannot complete its send until the receiver is ready.

The receiver cannot complete its receive until the sender has supplied a value.

The channel is therefore both a communication mechanism and a synchronization point.

⸻

Declare while receiving

Bil also provides :-> when the receiving variable should be declared at the receive:

c :-> x

This is equivalent to:

x := <-c

So these two forms have deliberately different meanings:

var x int
c -> x

and:

c :-> x

The first assigns to an existing variable.

The second introduces a new variable.

The distinction applies inside alt as well.

⸻

Two processes, one channel

Consider a producer and a consumer:

proc producer(c chan<- int) {
    c <- 10
    c <- 20
    c <- 30
}
proc consumer(c <-chan int) {
    var x int
    c -> x
    println(x)
    c -> x
    println(x)
    c -> x
    println(x)
}
func main() {
    c := make(chan int)
    par {
        producer(c)
        consumer(c)
    }
}

There is no shared queue between the processes.

The producer hands each value directly to the consumer.

That gives us a useful mental model:

producer                 consumer
   10 ──────────────────────>
   20 ──────────────────────>
   30 ──────────────────────>

The channel establishes both communication and synchronization.

⸻

Why the compiler cares

This is where Bil starts to differ substantially from ordinary Go.

Bil’s static checker enforces rules about how channels and variables are used between parallel processes. (GitHub)

For example, a channel cannot simply be read by several branches of the same par and written by several others.

The intended shape is:

one writer  ───── channel ───── one reader

This makes communication topology visible to the compiler.

Instead of discovering certain races while running a program, Bil rejects a number of problematic sharing patterns during bil vet.

⸻

No go

This is worth stating explicitly:

go worker()

is not Bil.

Use:

par {
    worker()
}

For multiple independent workers:

par {
    worker(0)
    worker(1)
    worker(2)
}

And for a runtime-sized collection:

par i := range n {
    worker(i)
}

The latter is Bil’s replicated parallel construct.

⸻

Replicated parallelism

Suppose we want ten workers:

const n = 10
par i := range n {
    worker(i)
}

This is roughly:

worker(0)
worker(1)
worker(2)
...
worker(9)

running concurrently.

It is particularly useful when the number of processes is known from a runtime value.

For example:

proc worker(id int) {
    println("worker", id)
}
func main() {
    const n = 4
    par i := range n {
        worker(i)
    }
}

The par block waits for all four workers.

⸻

Worker farms

A common concurrency pattern is a collection of independent workers.

Give every worker its own input and output channel:

const n = 4
proc worker(in <-chan int, out chan<- int) {
    var x int
    in -> x
    out <- x * x
}

Create the channels:

toWorker := makeChans[int](n)
fromWorker := makeChans[int](n)

Then start the workers:

par {
    par i := range n {
        worker(toWorker[i], fromWorker[i])
    }
    seq {
        for i := range n {
            toWorker[i] <- i + 1
        }
        for i := range n {
            println(<-fromWorker[i])
        }
    }
}

The structure is:

             ┌── worker 0 ──┐
             │              │
input ───────┼── worker 1 ──┼──── output
             │              │
             ├── worker 2 ──┤
             │              │
             └── worker 3 ──┘

makeChans[T](n) creates a slice of n channels and is provided by Bil. (GitHub)

⸻

seq

Bil also has seq:

seq {
    step1()
    step2()
    step3()
}

In ordinary Go, statements already execute sequentially.

So why have seq?

Because Bil’s concurrency notation is deliberately explicit.

When a program contains nested process structures, seq makes the intended execution structure obvious:

par {
    seq {
        prepare()
        send()
        finish()
    }
    worker()
}

Read it as:

          ┌── prepare → send → finish ──┐
main ─────┤                              ├── join
          └── worker ───────────────────┘

seq is mostly structural clarity in Bil rather than a new execution mechanism. (GitHub)

⸻

Waiting for one of several things

Fork/join is useful, but concurrent programs often need another operation:

Wait for whichever communication becomes available first.

That’s what alt does.

Consider two channels:

left := make(chan int)
right := make(chan int)

We can wait on either:

var x int
alt {
    left -> x {
        println("left:", x)
    }
    right -> x {
        println("right:", x)
    }
}

If left is ready first, the first branch runs.

If right is ready first, the second branch runs.

The process blocks until at least one guard can proceed.

Conceptually:

                  ┌── left ready  ──> branch 1
wait ── alt ──────┤
                  └── right ready ──> branch 2

This is the core of Bil’s event-driven concurrency model.

⸻

Conditional guards

An alt branch can also be conditional:

alt {
    (enabled) && left -> x {
        println("left", x)
    }
    right -> y {
        println("right", y)
    }
}

The first branch participates only when enabled is true.

This is useful when the set of events a process is willing to handle changes over time.

⸻

skip

Sometimes we want an alt to have a default action rather than block.

Use skip:

alt {
    c -> x {
        println("received", x)
    }
    skip {
        println("nothing available")
    }
}

skip is immediately ready.

Therefore this behaves like a non-blocking poll:

if c has a value:
    receive it
else:
    run the skip branch

Unlike a normal if, however, the communication guard remains part of the concurrency structure.

⸻

stop

stop terminates the current process permanently:

if done {
    stop
}

It is particularly useful in process pipelines.

For example:

proc worker(c <-chan int) {
    for {
        c :-> x
        if x < 0 {
            stop
        }
        println(x)
    }
}

A negative value is being used here as a protocol-level termination signal.

The worker does not return to its caller. It terminates the process.

⸻

alt and termination

A process can combine communication and termination:

proc worker(c <-chan int) {
    for {
        alt {
            c :-> x {
                if x < 0 {
                    stop
                }
                println(x)
            }
            skip {
                println("idle")
            }
        }
        time.Sleep(100 * time.Millisecond)
    }
}

The channel branch handles work.

The skip branch provides a default action.

stop provides the termination path.

⸻

Priority choice

Sometimes several guards are ready and the program needs a defined priority.

Bil provides:

pri alt {
    highPriority -> x {
        handleHigh(x)
    }
    lowPriority -> y {
        handleLow(y)
    }
}

With ordinary alt, the scheduler chooses among ready alternatives according to the construct’s selection semantics.

With pri alt, guards are considered in priority order.

So:

pri alt {
    A
    B
    C
}

means:

if A is ready: choose A
else if B is ready: choose B
else if C is ready: choose C
else wait

This is useful for protocols where some events must take precedence over others.

⸻

Pipelines

Channels become particularly useful when processes are connected into a pipeline.

Imagine:

generator → filter → filter → filter → output

Each stage is an independent process.

A simplified Bil pipeline looks like this:

proc generator(out chan<- int) {
    for v := 2; v <= 30; v++ {
        out <- v
    }
    stop
}
proc filter(in <-chan int, out chan<- int) {
    var prime int
    in -> prime
    println(prime)
    for {
        in :-> v
        if v%prime != 0 {
            out <- v
        }
    }
}

Create the channels:

const n = 10
channels := makeChans[int](n + 1)

Then connect the stages:

par {
    generator(channels[0])
    par i := range n {
        filter(channels[i], channels[i+1])
    }
}

The resulting topology is:

generator
    │
    ▼
 filter
    │
    ▼
 filter
    │
    ▼
 filter
    │
   ...

Each process owns its place in the pipeline.

There is no shared mutable queue connecting the stages.

Communication is explicit in the channel graph.

⸻

Channel direction

As in Go, channel parameters can express direction:

proc producer(out chan<- int) {
    out <- 42
}
proc consumer(in <-chan int) {
    var x int
    in -> x
}

The producer cannot receive from out.

The consumer cannot send to in.

This documents the protocol directly in the function signature.

For concurrent programs, that is valuable because the communication topology is visible at the boundary of every process.

⸻

Closing channels

Bil retains Go’s channel closing mechanism:

close(c)

And Bil supports the comma-ok receive form:

c -> x, ok

or:

c :-> x, ok

The latter declares both values.

For example:

proc consumer(c <-chan int) {
    for {
        c :-> x, ok
        if !ok {
            stop
        }
        println(x)
    }
}

ok becomes false when the channel is closed and drained.

This is one of the places where Bil deliberately retains Go semantics rather than copying occam exactly. (GitHub)

⸻

Shared variables

Bil’s most important difference from conventional Go concurrency is that it does not encourage arbitrary shared-memory communication between parallel processes.

For example, this pattern is problematic:

var counter int
par {
    counter++
    println(counter)
}

The issue isn’t merely that counter++ is not atomic.

The deeper issue is that two concurrent processes are sharing mutable state.

Bil’s checker applies restrictions to variables captured by parallel branches. A variable written by one branch cannot simply be read from another branch. (GitHub)

Instead, use communication.

For example:

proc increment(in <-chan int, out chan<- int) {
    in :-> x
    out <- x + 1
}

Now the state transition is explicit:

input → process → output

⸻

Reference types are deliberately restricted

Go makes it easy to share:

* pointers
* maps
* interfaces
* slices

between goroutines.

Bil is deliberately more restrictive.

Pointers, maps, and interfaces touched by multiple branches of the same par are rejected by the static checker, including read-only sharing of those reference types. (GitHub)

This is an important difference in programming style.

Instead of:

             ┌── goroutine A ──┐
shared map ──┤                 ├── concurrent access
             └── goroutine B ──┘

prefer:

             ┌── process A ──┐
message ─────┤               ├── message
             └── process B ──┘

The channel becomes the boundary.

⸻

Parallel writes to arrays and slices

Bil does allow parallel work over independent pieces of an array or slice when the checker can prove that the regions do not overlap.

The easiest way to express this is with splitN.

Suppose we want four workers to process a slice:

parts := splitN(data, 4)

Then:

par i := range 4 {
    process(parts[i])
}

Each worker receives a disjoint chunk.

The distinction matters:

data
├────────┬────────┬────────┬────────┤
 worker0 worker1  worker2  worker3

rather than:

data
└────── shared mutable object ──────┘

splitN2D provides the corresponding operation for two-dimensional data. (GitHub)

⸻

A parallel map

Suppose we want to square every element.

With a suitable split:

parts := splitN(values, 4)
par i := range 4 {
    for j := range parts[i] {
        parts[i][j] *= parts[i][j]
    }
}

The workers operate on disjoint regions.

The important property isn’t that there are four workers.

It is that the compiler can establish that the workers do not interfere.

⸻

Timeouts

Bil retains Go’s time package.

That means time can participate in an alt.

For example:

proc waitForData(c <-chan int) {
    timeout := time.After(time.Second)
    alt {
        c :-> x {
            println("received", x)
        }
        timeout -> _ {
            println("timeout")
        }
    }
}

This gives us the familiar shape:

                 ┌── data arrives ──> handle data
wait ── alt ─────┤
                 └── timer fires ───> timeout

Bil has a specific exception to its channel-sharing rule for time channels such as those returned by time.After; they may be read by multiple par branches. (GitHub)

⸻

Tagged messages

Sometimes a channel needs to carry different kinds of messages.

Go interfaces work naturally for this.

Define a marker interface:

type Message interface {
    isMessage()
}

Then define variants:

type Info struct {
    Code int
}
func (Info) isMessage() {}
type Warning struct {
    Code int
}
func (Warning) isMessage() {}

Send them through one channel:

proc sender(out chan<- Message) {
    out <- Info{Code: 1}
    out <- Warning{Code: 2}
}

And dispatch on the receiver:

proc receiver(in <-chan Message) {
    for range 2 {
        switch in :-> v.(type) {
        case Info:
            println("info", v.Code)
        case Warning:
            println("warning", v.Code)
        }
    }
}

The channel now carries a protocol:

Message
├── Info
└── Warning

Bil does not introduce a separate protocol declaration for this. It uses Go’s existing type system and type switches. (GitHub)

⸻

Communication is the architecture

At this point, the recurring pattern should be visible.

A Bil concurrent program tends to look like:

          ┌──────────────┐
          │   process    │
          └──────┬───────┘
                 │
              channel
                 │
          ┌──────▼───────┐
          │   process    │
          └──────┬───────┘
                 │
              channel
                 │
          ┌──────▼───────┐
          │   process    │
          └──────────────┘

Rather than putting locks around a shared data structure, you can make the data flow itself the synchronization mechanism.

This is particularly natural for:

* pipelines
* worker farms
* producers and consumers
* event loops
* state machines
* streaming transformations
* distributed-style topologies

⸻

A small state machine

Consider a process that accepts commands:

type Command interface {
    isCommand()
}
type Start struct{}
func (Start) isCommand() {}
type Stop struct{}
func (Stop) isCommand() {}
type Value struct {
    N int
}
func (Value) isCommand() {}

The process can then select messages:

proc machine(in <-chan Command) {
    running := false
    for {
        switch in :-> cmd.(type) {
        case Start:
            running = true
            println("started")
        case Stop:
            stop
        case Value:
            if running {
                println("value", cmd.N)
            }
        }
    }
}

The state belongs to one process.

Other processes don’t mutate it directly.

They send commands.

That is often a cleaner concurrency boundary than sharing the state between goroutines.

⸻

Backpressure comes for free

Because Bil channels are unbuffered, a sender and receiver rendezvous.

Consider:

producer -> channel -> consumer

If the consumer is slow, the producer eventually waits.

That gives the pipeline a natural form of backpressure.

There is no implicit buffered queue hiding between the two processes.

This can be useful when designing streaming systems because the flow-control relationship is explicit.

⸻

Fan-out

One producer can distribute work to several workers.

For example:

                 ┌── worker 0
                 │
producer ────────┼── worker 1
                 │
                 ├── worker 2
                 │
                 └── worker 3

With Bil, a common implementation is to give each worker its own channel and explicitly decide how work is distributed.

That keeps the channel topology visible and allows the compiler to check the individual communication paths.

⸻

Fan-in

The reverse is also useful:

worker 0 ──┐
worker 1 ──┤
worker 2 ──┼──> collector
worker 3 ──┘

A collector can use alt to wait for whichever worker produces a result next:

alt {
    results[0] -> x {
        handle(x)
    }
    results[1] -> y {
        handle(y)
    }
    results[2] -> z {
        handle(z)
    }
}

For runtime-sized collections, replicated alt can express the same idea more compactly:

alt i := range n {
    results[i] -> x {
        handle(i, x)
    }
}

This is particularly useful when the number of channels is determined dynamically. (GitHub)

⸻

alt is more than select

Go programmers will recognize the resemblance between alt and select.

For example, Go:

select {
case x := <-left:
    handle(x)
case y := <-right:
    handle(y)
}

Bil:

alt {
    left :-> x {
        handle(x)
    }
    right :-> y {
        handle(y)
    }
}

But Bil’s concurrency model goes beyond a single syntactic replacement.

par, replicated par, alt, replicated alt, pri alt, skip, and stop form a coherent process-oriented vocabulary.

The constructs are designed to describe the structure of concurrent execution rather than merely provide primitives for launching goroutines.

⸻

What Bil deliberately does not provide

Bil does not turn every Go concurrency technique into a Bil technique.

In particular, the language is intentionally restrictive around shared state.

A Go programmer might reach for:

mutex
atomic
shared map
WaitGroup
goroutine
buffered channel

Bil asks a different question first:

Can this be represented as processes communicating over channels?

Often the answer is yes.

For example, instead of:

many workers
      │
      ▼
shared map
      ▲
      │
many workers

you might create an owner process:

worker ──request──> map owner
worker <──response── map owner

Only one process owns the mutable map.

Everyone else communicates with it.

This is a classic process-and-channel design.

⸻

The compiler becomes part of the concurrency model

The important difference between Bil and a library-based concurrency style is that these rules are not merely recommendations.

Bil’s static checker rejects violations such as:

* buffered channels
* invalid channel sharing across par branches
* certain forms of shared mutable variables
* unsafe sharing of pointers, maps, and interfaces
* overlapping parallel writes

The goal is to make the communication structure statically visible. (GitHub)

So a useful workflow is:

write
  ↓
bil vet
  ↓
fix the communication topology
  ↓
bil run

Concurrency correctness becomes partly a compile-time property.

⸻

A complete example

Here is a small worker pipeline combining several of the ideas:

package main
const workers = 4
proc worker(in <-chan int, out chan<- int) {
    in :-> x
    out <- x * x
}
proc producer(out chan<- int) {
    for i := range workers {
        out <- i + 1
    }
    close(out)
}
proc main() {
    inputs := makeChans[int](workers)
    outputs := makeChans[int](workers)
    par {
        par i := range workers {
            worker(inputs[i], outputs[i])
        }
        producer(inputs[0])
        seq {
            for i := range workers {
                inputs[i] <- i + 10
            }
            for i := range workers {
                outputs[i] -> result
                println(result)
            }
        }
    }
}

The exact topology matters more than the arithmetic.

There are distinct processes.

They communicate through channels.

The par structure tells us which things may execute concurrently.

The compiler checks the resulting communication and sharing pattern.

⸻

The mental model

If you come from Go, it is tempting to think:

Go
 └── goroutines
      └── channels

A better mental model for Bil is:

Bil
 ├── processes
 │    └── par
 │
 ├── communication
 │    └── channels
 │
 ├── choice
 │    └── alt
 │
 └── termination
      ├── skip
      └── stop

The pieces fit together.

par says what can run concurrently.

Channels say how concurrent processes communicate.

alt says which communication to accept next.

skip says what to do when no communication is required.

stop says this process is finished permanently.

And the static checker says which communication structures are legal.

⸻

From Go to Bil

The translation is therefore not:

goroutine → Bil keyword

It is a change in how concurrency is structured.

Go encourages:

go worker()

Bil encourages:

par {
    worker()
    otherWorker()
}

Go often uses shared memory plus synchronization:

shared state
    +
mutex
    +
goroutines

Bil encourages:

process
    +
channel
    +
process

Go’s select becomes Bil’s alt:

select {
case x := <-a:
    ...
case y := <-b:
    ...
}

becomes:

alt {
    a :-> x {
        ...
    }
    b :-> y {
        ...
    }
}

And when the concurrency structure gets larger, Bil gives you replicated constructs:

par i := range n {
    worker(i)
}

and:

alt i := range n {
    channels[i] -> x {
        handle(i, x)
    }
}

The result is a language where concurrency is expressed as a topology of processes and communication rather than as a collection of independently launched goroutines.

⸻

In one sentence

Bil’s concurrency model can be reduced to a simple idea:

Run processes in parallel, make them communicate through channels, and let the compiler enforce the boundaries.

Once that model clicks, par, alt, proc, seq, skip, and stop stop looking like unusual syntax.

They become the vocabulary for describing concurrent programs.
