---
type: Attested Computation
title: Revenue for fiscal year
description: Recognized revenue for a fiscal year.
runtime: bigquery
parameters:
  - { name: year, type: integer, required: true }
executor:
  resource: /references/run-on-bq.md
  receipt: [job_id, executed_sql, result]
attester:
  resource: /references/sql_equality.py
verified: { by: human:jane@acme.example, at: 2026-06-02T09:00:00Z }
---

# Computation

```sql
SELECT SUM(amount) FROM finance.revenue WHERE fiscal_year = @year
```

Built on the [orders table](../tables/orders.md). A dbt version would use `{{ ref('orders') }}`.
