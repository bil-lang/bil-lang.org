---
layout: single
permalink: /guide/
author_profile: false
---

{% capture content %}
{% include_relative external/bil/docs/guide.md %}
{% endcapture %}
{{ content }}

<style>
  .mermaid { overflow-x: auto; margin: 1.5em 0; }
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
      mermaid.run({ querySelector: '.mermaid' }).then(function () {
        // Drop the width="100%" mermaid sets on each svg so it renders at
        // its own natural (viewBox) size instead of being shrunk to fit
        // the narrow content column -- with 21 diagrams of very
        // different complexity here, a single fixed pixel width (as
        // used on the homepage's one diagram) doesn't fit them all.
        // .mermaid's own overflow-x:auto scrolls any that are still
        // wider than the column.
        document.querySelectorAll('.mermaid svg').forEach(function (svg) {
          svg.removeAttribute('width');
          svg.style.maxWidth = 'none';
          svg.style.height = 'auto';
        });
      });
    }
  });
</script>
