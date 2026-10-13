---
name: git-save
description: "現在の作業差分を確認し、変更内容に合うコミットを作成してpushする。変更をGitHubへ保存したいときに使う。"
argument-hint: "変更内容の補足があれば入力（省略可）"
user-invocable: true
---

# Gitに保存してpush

現在の作業差分を確認し、適切なコミットメッセージを作成してGitHubへpushしてください。

## 手順

1. `git status --short --branch` でブランチ、追跡対象外ファイル、ステージ済み・未ステージの変更を確認します。
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
9. commit成功後、現在のブランチのupstreamへpushします。upstreamが未設定の場合は `origin` の現在のブランチへ `git push -u origin <branch>` を使います。
10. 最後に、commitのハッシュ・メッセージ・push先を報告します。

## 守ること

- `git add -A` で無差別に全変更をステージしないでください。対象ファイルを明示してください。
- `git reset`、`git checkout`、`git restore`、force push、commit amend、履歴改変を行わないでください。
- テストやLintは実行しないでください。必要な場合は別途提案してください。
- commitまたはpushが失敗したら、同じ操作を繰り返さず、エラーと現在のGit状態を報告してください。
- 引数で変更内容の補足が指定されていれば、差分の解釈とメッセージ作成に利用してください。
