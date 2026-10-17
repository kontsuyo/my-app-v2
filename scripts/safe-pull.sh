#!/usr/bin/env bash
set -euo pipefail

die() {
    printf 'Safe pull stopped: %s\n' "$*" >&2
    exit 1
}

root="$(git rev-parse --show-toplevel)" || die "Run this command inside a working repository."
cd "$root"

branch="$(git symbolic-ref --quiet --short HEAD)" ||
    die "Cannot update a detached HEAD. Switch to the intended branch before retrying."

for state in MERGE_HEAD rebase-merge rebase-apply CHERRY_PICK_HEAD REVERT_HEAD sequencer BISECT_START; do
    if test -e "$(git rev-parse --git-path "$state")"; then
        die "A Git operation is in progress ($state). Finish or abort it before retrying."
    fi
done

status="$(git status --porcelain --untracked-files=all --ignore-submodules=none)"
if test -n "$status"; then
    die "Uncommitted changes found. Commit or move them before retrying; nothing is stashed automatically."
fi

git rev-parse --symbolic-full-name '@{upstream}' >/dev/null ||
    die "No upstream is configured. Set the intended tracking branch before retrying."
remote="$(git for-each-ref --format='%(upstream:remotename)' "refs/heads/$branch")"
remote_ref="$(git for-each-ref --format='%(upstream:remoteref)' "refs/heads/$branch")"
test -n "$remote" && test -n "$remote_ref" ||
    die "The upstream remote or branch is missing."

git fetch --no-tags --no-recurse-submodules -- "$remote" "$remote_ref" ||
    die "Fetch failed. HEAD and working files were not updated."
target="$(git rev-parse --verify 'FETCH_HEAD^{commit}')"
if git merge-base --is-ancestor "$target" HEAD; then
    echo "Already up to date (local commits, if any, are preserved)."
    exit 0
fi
if ! git merge-base --is-ancestor HEAD "$target"; then
    die "Local and upstream histories have diverged. Review them manually; no merge or rebase was performed."
fi
git -c merge.autoStash=false merge --ff-only --no-autostash --no-overwrite-ignore "$target"
