---
name: git-save
description: "リモートとの履歴分岐を事前確認し、現在の作業差分をコミットしてpushする。変更をGitHubへ保存したいときに使う。"
argument-hint: "変更内容の補足があれば入力（省略可）"
user-invocable: true
---

# Gitに保存してpush

現在の作業差分を確認し、適切なコミットメッセージを作成してGitHubへpushしてください。

## 手順

1. `git status --short --branch` でブランチ、追跡対象外ファイル、ステージ済み・未ステージの変更を確認します。
   - detached HEAD、merge / rebase / cherry-pick / revert / bisect などの作業途中なら停止します。
   - **ステージ・commit前に、下記「リモートの事前確認」を実行します。** `git status` の ahead / behind 表示だけでは、未取得のリモート変更は分かりません。
2. 差分と関連ファイルを調べ、変更内容を把握します。未追跡ファイルは内容も確認します。
3. 今回の作業に関係する変更だけを対象にします。ステージ済みの変更も内容を確認し、今回の作業に関係する場合に限り含めます。依頼範囲外の変更や意図が判断できない変更が混在していたら、何が混在しているか報告して停止します。
4. 秘密情報、`.env`、認証情報、DBファイル、生成物などを含めません。混入が疑われる場合は停止し、ユーザーに確認します。
5. `git diff --check` 相当の確認を行い、空白エラーがあれば修正せず報告して停止します。
6. 差分の主目的を表すコミットメッセージを自動作成します。Conventional Commits形式を使い、typeは `feat`、`fix`、`refactor`、`test`、`docs`、`chore`、`build`、`ci` から選びます。subjectは日本語で簡潔にし、例は `feat: 投稿一覧APIを追加` です。
7. 対象ファイルだけを `git add` し、ステージ済み差分を再確認します。対象外の変更が入っていればcommitせず停止します。
8. 作成したメッセージをユーザーに示し、そのメッセージでcommitします。このスキルの実行自体をcommit・pushの依頼として扱い、差分に問題がなければ追加の確認を求めず進めます。コミットメッセージには次のCo-authored-by trailerを含めます。
   ```text
   Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
   ```
9. commit成功後、下記「リモートの事前確認」を再実行します。成功した場合だけ、確認したremote・remote_refを使って `git push -- "$remote" "HEAD:$remote_ref"` を実行します。別の追跡先やpush設定を暗黙に使わないでください。
10. 最後に、commitのハッシュ・メッセージ・push先を報告します。

## リモートの事前確認

リポジトリ直下で、次の順に確認します。各コマンドが失敗したら停止し、失敗理由と作業ツリー・HEADの状態を報告します。

1. `git symbolic-ref --quiet --short HEAD` でブランチを取得し、`git rev-parse --symbolic-full-name '@{upstream}'` で設定済みupstreamを確認します。upstream未設定なら、push先を推測せずユーザーに確認して停止します。
2. 取得したブランチ名を `branch` とし、既存の安全なpullと同じ方法で追跡先を取得します。
   ```bash
   remote="$(git for-each-ref --format='%(upstream:remotename)' "refs/heads/$branch")"
   remote_ref="$(git for-each-ref --format='%(upstream:remoteref)' "refs/heads/$branch")"
   ```
   どちらかが空の場合も停止します。
3. `git fetch --no-tags --no-recurse-submodules -- "$remote" "$remote_ref"` を実行し、`git rev-parse --verify 'FETCH_HEAD^{commit}'` で取得したコミットを `target` として記録します。fetch失敗時に古い追跡参照や以前の `FETCH_HEAD` を使って続行してはいけません。
4. `git merge-base --is-ancestor "$target" HEAD` を実行します。
   - 終了コード0: リモートの履歴を取り込み済みです。同一またはローカル先行なので保存手順を続けます。
   - 終了コード1: リモートの更新が未取り込みです。ステージ・commit・pushせず停止します。commit後の再確認なら作成済みcommitを保持します。`git merge-base --is-ancestor HEAD "$target"` でリモート先行か履歴分岐かを区別して報告します。
   - それ以外: 判定エラーとして停止します。

未コミット変更があっても、この確認は作業ファイル・ステージ・ローカル履歴を変更しません。fetchによってリモート追跡参照や `FETCH_HEAD` は更新されることがあります。
停止時に自動stash・pull・rebase・mergeで解消しないでください。特に、未コミット変更を保存するためのスキルなので、常に `safe-pull.sh` を先に実行する方式にはしないでください。
作業開始前のクリーンな状態で [`/git-pull`](../git-pull/SKILL.md) を使う運用を案内し、既に変更がある場合の退避・統合方法はユーザーに確認します。
最終確認後からpushまでの間に別のpushが発生する競合は完全には防げません。その場合も通常のpushの拒否を尊重して停止します。

## 守ること

- `git add -A` で無差別に全変更をステージしないでください。対象ファイルを明示してください。
- 停止理由を回避するための自動stash・rebase・merge・追跡先変更は行わないでください。
- `git reset`、`git checkout`、`git restore`、force push、commit amend、履歴改変を行わないでください。
- テストやLintは実行しないでください。必要な場合は別途提案してください。
- commitまたはpushが失敗したら、同じ操作を繰り返さず、エラーと現在のGit状態を報告してください。
- 引数で変更内容の補足が指定されていれば、差分の解釈とメッセージ作成に利用してください。
