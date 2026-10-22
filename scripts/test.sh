#!/bin/bash
# この案件のテスト。失敗したら 0 以外で終わる。
set -euo pipefail
cd "$(dirname "$0")/.."
node --test tests/
