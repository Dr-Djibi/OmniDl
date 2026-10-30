## 2025-05-18 - [Base64 Decoding Lookup Table Optimization]
**Learning:** `String.prototype.indexOf` inside character decoding loops creates O(N * M) overhead per character scan. Precomputing a 256-element typed array lookup table (`Int16Array`) and using `charCodeAt()` turns lookup into direct O(1) memory access.
**Action:** When parsing encoded binary strings or base64 data streams, use ASCII lookup tables instead of linear string search methods.
