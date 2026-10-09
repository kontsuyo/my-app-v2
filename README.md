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
