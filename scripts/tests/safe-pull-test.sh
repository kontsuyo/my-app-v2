#!/usr/bin/env bash
set -euo pipefail

SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/safe-pull.sh"
TEMP="$(mktemp -d)"
trap 'rm -rf "$TEMP"' EXIT
export GIT_CONFIG_NOSYSTEM=1
export GIT_CONFIG_GLOBAL=/dev/null
export GIT_AUTHOR_NAME="Safe Pull Test"
export GIT_AUTHOR_EMAIL="safe-pull@example.invalid"
export GIT_COMMITTER_NAME="$GIT_AUTHOR_NAME"
export GIT_COMMITTER_EMAIL="$GIT_AUTHOR_EMAIL"
export GIT_TERMINAL_PROMPT=0

setup() {
    git init --bare --initial-branch=main "$TEMP/remote.git" >/dev/null
    git clone "$TEMP/remote.git" "$TEMP/publisher" 2>/dev/null
    cd "$TEMP/publisher"
    echo initial > tracked.txt
    git add tracked.txt
    git commit -qm initial
    git push -q origin main
    git clone "$TEMP/remote.git" "$TEMP/work" 2>/dev/null
    echo remote >> tracked.txt
    git commit -qam remote
    git push -q origin main
    TARGET="$(git rev-parse HEAD)"
    cd "$TEMP/work"
    BEFORE="$(git rev-parse HEAD)"
}

test_fast_forward() {
    : '通常の更新を取り込めることを確認し、安全策で正常系を妨げない。'
    setup
    git config pull.rebase true
    bash "$SCRIPT"
    test "$(git rev-parse HEAD)" = "$TARGET"
    test -z "$(git status --porcelain)"
}

assert_stopped() {
    if bash "$SCRIPT" > "$TEMP/output" 2>&1; then
        echo "Expected safe pull to stop" >&2
        cat "$TEMP/output" >&2
        exit 1
    fi
    test "$(git rev-parse HEAD)" = "$BEFORE"
    grep -q "$1" "$TEMP/output"
}

test_dirty_tree() {
    : '変更の種類にかかわらず停止し、手元の作業を更新から保護する。'
    setup
    for kind in unstaged staged untracked; do
        case "$kind" in
            unstaged) echo local > local.txt; git add local.txt; git commit -qm local; echo edited >> local.txt ;;
            staged) git add local.txt ;;
            untracked) git restore --staged local.txt; git restore local.txt; echo precious > untracked.txt ;;
        esac
        BEFORE="$(git rev-parse HEAD)"
        assert_stopped "Uncommitted"
        if test "$kind" != untracked; then
            grep -q edited local.txt
        else
            test "$(cat untracked.txt)" = precious
        fi
        test "$(git rev-parse origin/main)" != "$TARGET"
    done
}

test_diverged_history() {
    : '分岐した履歴は自動統合せず停止し、ローカルコミットを書き換えない。'
    setup
    echo local > local.txt
    git add local.txt
    git commit -qm local
    BEFORE="$(git rev-parse HEAD)"
    assert_stopped "diverged"
    test ! -e "$(git rev-parse --git-path MERGE_HEAD)"
    test -z "$(git status --porcelain)"
}

test_operation_in_progress() {
    : '作業ツリーが綺麗でも進行中の操作を優先し、途中状態を壊さない。'
    setup
    for state in MERGE_HEAD rebase-merge rebase-apply CHERRY_PICK_HEAD REVERT_HEAD sequencer BISECT_START; do
        state_path="$(git rev-parse --git-path "$state")"
        case "$state" in
            rebase-*|sequencer) mkdir "$state_path" ;;
            *) echo "$BEFORE" > "$state_path" ;;
        esac
        assert_stopped "in progress"
        test -e "$state_path"
        test "$(git rev-parse origin/main)" != "$TARGET"
        case "$state" in
            rebase-*|sequencer) rmdir "$state_path" ;;
            *) rm "$state_path" ;;
        esac
    done
}

test_missing_tracking_branch() {
    : '取り込み先が不明なときは通信せず停止し、意図しないブランチを使わない。'
    setup
    git branch --unset-upstream
    assert_stopped "upstream"
    test "$(git rev-parse origin/main)" != "$TARGET"
}

test_detached_head() {
    : 'ブランチ外の更新は作業を見失いやすいため、更新前に明示的に拒否する。'
    setup
    git checkout -q --detach
    assert_stopped "detached HEAD"
    test "$(git rev-parse origin/main)" != "$TARGET"
}

test_deleted_remote_branch() {
    : '削除済みブランチの古い追跡参照を正常扱いせず、取得失敗を通知する。'
    setup
    git --git-dir="$TEMP/remote.git" symbolic-ref HEAD refs/heads/other
    git --git-dir="$TEMP/remote.git" update-ref -d refs/heads/main
    assert_stopped "Fetch failed"
    test "$(git rev-parse origin/main)" != "$TARGET"
}

test_fetch_failure() {
    : 'リモートに接続できない場合は古い履歴を使わず、作業内容を維持して失敗する。'
    setup
    git remote set-url origin "$TEMP/missing.git"
    assert_stopped "Fetch failed"
    test "$(git rev-parse origin/main)" != "$TARGET"
    test -z "$(git status --porcelain)"
}

test_local_commits_preserved() {
    : 'ローカルが先行していてもコミットは削除せず、再実行も安全に終了する。'
    setup
    bash "$SCRIPT"
    echo local > local.txt
    git add local.txt
    git commit -qm local
    BEFORE="$(git rev-parse HEAD)"
    bash "$SCRIPT"
    test "$(git rev-parse HEAD)" = "$BEFORE"
    test "$(cat local.txt)" = local
    test -z "$(git status --porcelain)"
}

test_configured_upstream_from_worktree() {
    : '別名リモートと異名ブランチを尊重し、worktree内の下位ディレクトリからも正しく更新する。'
    setup
    git remote rename origin source
    git branch -m feature
    git worktree add -q -b linked-branch "$TEMP/linked" feature
    cd "$TEMP/linked"
    git branch --set-upstream-to=source/main >/dev/null
    mkdir nested
    cd nested
    bash "$SCRIPT"
    test "$(git rev-parse HEAD)" = "$TARGET"
    test "$(git symbolic-ref --short HEAD)" = linked-branch
    test -z "$(git status --porcelain)"
}

test_ignored_file_collision() {
    : '無視対象のファイルも上書きから保護し、ローカル専用の設定等を失わない。'
    setup
    cd "$TEMP/publisher"
    echo remote > ignored.txt
    git add ignored.txt
    git commit -qm ignored-collision
    git push -q origin main
    cd "$TEMP/work"
    echo ignored.txt >> "$(git rev-parse --git-path info/exclude)"
    echo precious > ignored.txt
    assert_stopped "overwritten"
    test "$(cat ignored.txt)" = precious
    test -z "$(git status --porcelain)"
}

case "${1:-all}" in
    all)
        for name in fast_forward dirty_tree diverged_history operation_in_progress missing_tracking_branch detached_head deleted_remote_branch fetch_failure local_commits_preserved configured_upstream_from_worktree ignored_file_collision; do
            bash "$0" "$name"
        done
        exit 0
        ;;
    fast_forward) test_fast_forward ;;
    dirty_tree) test_dirty_tree ;;
    diverged_history) test_diverged_history ;;
    operation_in_progress) test_operation_in_progress ;;
    missing_tracking_branch) test_missing_tracking_branch ;;
    detached_head) test_detached_head ;;
    deleted_remote_branch) test_deleted_remote_branch ;;
    fetch_failure) test_fetch_failure ;;
    local_commits_preserved) test_local_commits_preserved ;;
    configured_upstream_from_worktree) test_configured_upstream_from_worktree ;;
    ignored_file_collision) test_ignored_file_collision ;;
    *) echo "Unknown test: $1" >&2; exit 1 ;;
esac
echo "PASS: $1"
