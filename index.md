---
layout: single
permalink: /
title: "Bil"
author_profile: true
---

**Bil**: a variant of Go for parallel processor systems.

Bil and Go both have concurrency models that are heavily inspired by Hoare's CSP.

Go is a general-purpose language that borrows CSP's channel-and-process ideas but relaxes them with buffering, dynamic concurrency, and conventional shared-memory mechanisms

Bil is a special-purpose language for parallel processor systems; influenced by CSP, by Go and by May's occam. Built on the Go toolchain, it constrains and shapes the Go concurrency model to encourage a higher level of discipline as needed by parallel systems. Bil helps coders to reason about their process models and to selectively place processes on to physical processors.

```go
package main

func main() {
	c := make(chan int)

	par {
		seq {
			c <- 42
			c <- 99
		}
		seq {
			var x, y int
			c -> x
			c -> y
			println(x)
			println(y)
		}
	}
}
```

#### Topology

```mermaid
graph LR
    sender -->|c: int| receiver
```

A Bil **process** is a code unit that can be run in **parallel** with other processes. Processes can be run in any order. Processes can be run in parallel by placing them on multiple physical processors. Processes can be run concurrently on a single processor. Processes do not share memory. Processes may be nested.

A Bil **channel** is a unidirectional, bilateral process-to-process message passing interface. One process outputs data to a channel with `<-`, the other inputs data with `->`. Channels are unbuffered: the sender blocks on output and the receiver blocks on input. Channels may be placed on physical point-to-point interprocessor links.

A `seq {}` block contains a list of expressions that are run in _sequence_. When a `seq` is entered, each expression is run in the specified order. When the last expression finishes, the block is done and the program proceeds.

A `par {}` block contains a list of expressions that are run in _parallel_. When a `par` is entered, a each expression is run independently on a dedicated thread with its own memory (a _fork_). When all expressions are finished, the block is done (a _join_) and the program proceeds.

_In regular Go, processes (i.e. goroutines) can share memory freely with each other and channels can be buffered. In contrast, by avoiding shared memory dependencies and associated race conditions, Bil's model facilitates the placement of parallel processes onto multiple physical processors (and channels to links) for large scale parallelism. When Bil parallel processes share a processor, they run concurrently as time-sliced threads (i.e. as goroutines), taking advantage of multiple cores if available._

A Bil emulator (`WASM`) implements a parallel processor mesh to model and test massively parallel systems. Other emulators & targets are available.

<script src="{{ '/vendor/mermaid/mermaid.min.js' | relative_url }}"></script>
<script>
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('pre code.language-mermaid, div.language-mermaid pre.highlight code').forEach(function (code) {
      var pre = document.createElement('pre');
      pre.className = 'mermaid';
      pre.textContent = code.textContent;
      var wrapper = code.closest('div.language-mermaid') || code.closest('pre');
      wrapper.replaceWith(pre);
    });
    if (window.mermaid) {
      mermaid.initialize({ startOnLoad: false });
      mermaid.run({ querySelector: '.mermaid' });
    }
  });
</script>
