---
name: git-pull
description: "現在のブランチを安全にgit pullしたいときに使う。未コミット変更や履歴の分岐を検出して停止し、設定済みupstreamからfast-forwardのみで更新する。"
user-invocable: true
---

# 安全に pull

このスキルの実行を、現在のブランチを設定済み upstream から更新する依頼として扱います。
安全判定は [safe-pull.sh](../../../scripts/safe-pull.sh) に集約し、通常の `git pull` で代用しないでください。

## 手順

1. リポジトリ直下で `git status --short --branch` を実行し、現在のブランチと変更状況を確認します。
2. `git rev-parse HEAD` で更新前のコミットを記録します。
3. リポジトリ直下から次を1回実行します。スクリプトが見つからない場合は停止して報告し、通常の `git pull` に切り替えないでください。
   ```bash
   bash scripts/safe-pull.sh
   ```
4. バックグラウンド実行になった場合は、同じ実行の完了結果を取得します。完了前に再実行しないでください。
5. 成功・失敗にかかわらず、`git status --short --branch` と `git rev-parse HEAD` で実行後の状態を確認します。
6. 成功時は対象ブランチ・upstream・更新前後のコミットを報告します。更新がなければその旨を伝えます。失敗時はエラーと現在の状態を報告して停止します。

## 安全策

- fast-forward のみを許可し、ローカルの先行コミットは保持します。
- 未コミット変更・未追跡ファイル・submodule の変更があれば停止します。
- merge / rebase / cherry-pick / revert / bisect などの作業途中は停止します。
- detached HEAD、upstream 未設定、取得失敗、リモートブランチ削除、履歴分岐では停止します。
- `.gitignore` 対象のローカルファイルも、取り込みによる上書きから保護します。

## 守ること

- 自動 stash、commit、push、rebase、マージコミット作成、reset、restore、checkout、履歴改変は行わないでください。
- Git 設定や upstream を自動変更しないでください。追跡先が不明ならユーザーに確認します。
- 停止理由を回避するためにオプションを緩めたり、失敗した操作を自動で再実行したりしないでください。
- 実行中は同じリポジトリを変更する別のコマンドを並行実行しないでください。
- fetch 後に失敗した場合、リモート追跡参照や `FETCH_HEAD` は更新されている可能性があります。「何も変更されていない」と断定しないでください。
- テストや Lint は実行しないでください。pull の成功と取得したコードの動作保証は区別してください。
