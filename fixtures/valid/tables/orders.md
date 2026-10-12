---
type: BigQuery Table
title: Orders
description: One row per completed order.
resource: https://console.cloud.google.com/bigquery?p=acme&d=sales&t=orders
tags: [sales, orders]
status: stable
generated: { by: reference_agent/gemini-2.5-pro, at: 2026-06-01T12:00:00Z }
verified:
  - { by: human:jane@acme.example, at: 2026-06-02T09:00:00Z }
  - { by: process:nightly-check, at: 2026-06-03T02:00:00+02:00 }
stale_after: 2026-12-31T00:00:00Z
sources:
  - id: schema
    resource: https://acme.example/docs/orders-schema
    title: Orders schema
    author: team:data-platform
    usage_count: 120
    last_modified: 2026-05-30T00:00:00Z
usage_window: { from: 2026-05-01T00:00:00Z, to: 2026-05-31T00:00:00Z }
---

# Schema

One row per order, keyed by `order_id`.[^schema] Revenue is [computed here](/computations/revenue.md).

[^schema]: Orders schema
