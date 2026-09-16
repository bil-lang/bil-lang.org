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

```mermaid
flowchart TD
    CSP["CSP<br/>Hoare, 1978/85"]
    Newsqueak["Newsqueak<br/>Pike"]
    Go["Go<br/>2009"]
    occam["occam<br/>May"]
    Bil["Bil<br/>today"]

    CSP -->|1988| Newsqueak
    CSP -->|1983| occam
    occam --->|process model| Bil
    Newsqueak -->|Alef, Limbo| Go
    Go -->|syntax & tooling| Bil

    style Bil stroke:#e0a82e,stroke-width:3px
```

Bil is intended for parallel processor systems, but also efficiently supports single processor and multicore shared memory processor architectures for easier reasoning about concurrent code, software development and educational purposes. A Bil emulator (`WASM`) implements a parallel processor mesh to model and test massively parallel systems.

<style>
  .mermaid { overflow-x: auto; }
  .mermaid svg { width: 900px !important; max-width: none !important; height: auto !important; }
</style>
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
