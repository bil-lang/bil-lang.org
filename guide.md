---
layout: single
permalink: /guide/
author_profile: true
---

{% capture content %}
{% include_relative external/bil/docs/guide.md %}
{% endcapture %}
{{ content | replace: '[^^](#top)', '[⇧ top](#top)' }}

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
