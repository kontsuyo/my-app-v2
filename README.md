# Patina Gallery

ブーツの写真を投稿・共有し、経年変化(Patina)を楽しむWebアプリケーション。
バックエンドエンジニアへの転職ポートフォリオを主目的とし、Django REST Framework による
API 設計と AWS 上での本番運用構成を重点的に扱う。

## 技術スタック

| 領域           | 技術                                                     |
| -------------- | -------------------------------------------------------- |
| バックエンド   | Python 3.12 / Django 5 / Django REST Framework / JWT     |
| データベース   | PostgreSQL 16                                            |
| フロントエンド | Next.js 15 / TypeScript / Tailwind CSS / shadcn/ui       |
| インフラ       | AWS(ECS Fargate / RDS / S3 + CloudFront)/ GitHub Actions |

詳細は [docs/SPEC.md](docs/SPEC.md)、実装手順は [plan.md](plan.md) を参照。

## リポジトリ構成

```
.
├── backend/     # Django + DRF (API サーバー)
├── frontend/    # Next.js (Web フロントエンド)
├── docs/        # 仕様書
└── plan.md      # 実装チェックリスト
```

## 開発方針

- 開発中はローカルで **uv** を使い、DB のみ Docker で起動する。
- 本番と同じ環境の再現は Docker 化(Phase 5)で対応する。

### 安全な pull

リポジトリ直下で次を実行する。

```bash
bash scripts/safe-pull.sh
```

VS Code では「ターミナル → タスクの実行 → Git: Safe Pull」からも実行できる。
Copilot チャットでは共有スキル [`/git-pull`](.github/skills/git-pull/SKILL.md) で同じ安全な更新を依頼できる。
現在のブランチに設定済みの upstream だけを fetch し、**fast-forward のみ**で更新する。
ローカルコミットが先行している場合は、そのまま保持する。

次の場合はエラーで停止する。

- 未コミット変更がある（ステージ済み・未ステージ・未追跡ファイル・submodule の変更を含む）
- merge / rebase / cherry-pick / revert / bisect などの作業途中
- detached HEAD、または upstream が未設定
- リモートの取得に失敗した、または対象ブランチが削除されている
- ローカルと upstream の履歴が分岐している
- 取り込みによって `.gitignore` 対象のローカルファイルが上書きされる

自動 stash・rebase・マージコミット作成・reset は行わない。
停止したら表示された理由を確認し、変更のコミットや進行中の操作の完了などを行ってから再実行する。
履歴の分岐は内容を確認して手動で解消する。upstream は意図した追跡先を確認して
`git branch --set-upstream-to=origin/<branch>` で設定する。

通常の `git pull` や VS Code 標準の「同期」を置き換えるものではないため、このコマンドまたはタスクを使うこと。
Git 設定は変更しない。実行中は別のターミナルやツールから同じリポジトリを操作しない。
fetch 後に停止した場合、リモート追跡参照や `FETCH_HEAD` は更新されることがあるが、ローカルコミットは書き換えない。

回帰テストは一時的なローカルリポジトリのみを使い、実際のリモートには接続しない。
CI でも同じテストを実行する。

```bash
bash scripts/tests/safe-pull-test.sh
```

## セットアップ

### 前提

- Python 3.12 / [uv](https://docs.astral.sh/uv/)
- Node.js 20 以上
- Docker(PostgreSQL 用)

### バックエンド(準備中)

```bash
cd backend
uv venv
uv sync
uv run python manage.py migrate
uv run python manage.py runserver
```

バックエンドのテスト・品質チェックはリポジトリ直下から実行する。

```bash
uv run --project backend pytest -c backend/pyproject.toml backend
uv run --project backend ruff check backend
uv run --project backend black --check backend
cd backend && uv run mypy
```

OpenAPI仕様は `/api/schema/`、Swagger UI は `/api/schema/swagger-ui/` で確認できる。

### フロントエンド(準備中)

```bash
cd frontend
npm install
npm run dev
```

## 環境変数

`.env.example` をコピーして `.env` を作成する。

```bash
cp .env.example .env
```
