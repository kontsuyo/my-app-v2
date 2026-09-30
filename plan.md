# Patina Gallery — 実装チェックリスト(plan.md)

> [docs/SPEC.md](docs/SPEC.md) に基づく実装計画。上から順に進める。
> バックエンド重点 → AWS → フロントエンド の優先順位で、各フェーズ完了後に動作確認する。

---

## Phase 0: プロジェクト初期設定

- [ ] リポジトリ構成を決定(`backend/` と `frontend/` のモノレポ or 分割)
- [ ] `.gitignore` を作成(Python / Node / macOS / 環境変数)
- [ ] Git リポジトリ初期化・初回コミット
- [ ] `README.md` にプロジェクト概要を記載
- [ ] `.env.example` を作成(DB接続情報・シークレットのテンプレート)

---

## Phase 1: バックエンド基盤(Django + DRF)

> 方針: 開発中(Phase 1〜4)は **uv でローカル開発**(高速・IDE補完/デバッグが効く)。
> **DB だけ Docker** で立てる(Mac に直接入れず後片付けを楽にする)。
> 本番と同じ環境の再現は Phase 5 で Docker 化して対応する。

### 1.1 環境構築

- [ ] `backend/` ディレクトリ作成
- [ ] uv で Python 3.12 仮想環境を作成(`uv venv`)
- [ ] 依存パッケージを追加(`uv add django djangorestframework psycopg python-dotenv`)
- [ ] `pyproject.toml` / `uv.lock` がコミット対象になっていることを確認
- [ ] `uv run django-admin startproject config .` でプロジェクト作成
- [ ] VS Code のインタープリタに `.venv` を指定(補完・型チェックを有効化)
- [ ] `settings.py` を環境変数ベースに分割(SECRET_KEY / DEBUG / DB を env から読む)

### 1.2 データベース接続

- [ ] PostgreSQL を Docker で起動(`docker run` or 単体の compose サービス)
- [ ] `settings.py` の DATABASES を PostgreSQL に設定
- [ ] 初回マイグレーション実行・接続確認

### 1.3 カスタムユーザーモデル

- [ ] `accounts` アプリ作成
- [ ] `AbstractUser` を拡張したカスタム User モデルを定義(email をログインIDに)
- [ ] `AUTH_USER_MODEL` を設定
- [ ] マイグレーション作成・適用
- [ ] `createsuperuser` で管理ユーザー作成・admin ログイン確認

---

## Phase 2: ドメインモデル(Post / Like)

- [ ] `posts` アプリ作成
- [ ] `Post` モデル定義(user, image_url, brand, model, caption, timestamps)
- [ ] `Like` モデル定義(user, post, `unique_together`)
- [ ] マイグレーション作成・適用
- [ ] admin に Post / Like を登録して管理画面から動作確認

---

## Phase 3: DRF API 実装(重点領域)

### 3.1 認証(JWT)

- [ ] `djangorestframework-simplejwt` を導入
- [ ] `/api/v1/auth/register/`(ユーザー登録)実装
- [ ] `/api/v1/auth/login/`(access/refresh 発行)実装
- [ ] `/api/v1/auth/token/refresh/` 実装
- [ ] `/api/v1/auth/me/`(ログインユーザー取得)実装

### 3.2 投稿 CRUD

- [ ] `PostSerializer` 実装(user ネスト、like_count / liked_by_me を含む)
- [ ] `PostViewSet` 実装(list / retrieve / create / update / destroy)
- [ ] Router で `/api/v1/posts/` を登録
- [ ] N+1 対策(`select_related('user')` / `annotate(like_count=...)`)
- [ ] ページネーション設定(PageNumberPagination)

### 3.3 権限制御

- [ ] `IsAuthenticatedOrReadOnly` を全体に適用
- [ ] `IsOwnerOrReadOnly`(オブジェクトレベル権限)を実装し update/destroy に適用

### 3.4 いいね

- [ ] `POST /api/v1/posts/{id}/like/`(いいね)実装
- [ ] `DELETE /api/v1/posts/{id}/like/`(いいね解除)実装
- [ ] 二重いいね防止のバリデーション

### 3.5 画像アップロード(S3 署名付きURL)

- [ ] `boto3` を導入
- [ ] `POST /api/v1/uploads/presign/`(署名付きPUT URL 発行)実装
- [ ] ローカル開発用に MEDIA 保存へフォールバックできる仕組み(`django-storages`)
- [ ] Content-Type / 拡張子のバリデーション

---

## Phase 4: 品質担保(テスト・ドキュメント)

- [ ] `pytest` / `pytest-django` / `factory_boy` を導入
- [ ] User / Post / Like の factory 作成
- [ ] 認証 API のテスト(登録・ログイン・トークン更新)
- [ ] 投稿 CRUD のテスト(正常系・異常系・権限)
- [ ] いいね API のテスト(付与・解除・二重防止)
- [ ] `drf-spectacular` を導入し `/api/schema/swagger-ui/` を有効化
- [ ] `ruff` / `black` / `mypy` の設定と CI 前チェック

---

## Phase 5: ローカル統合(Docker Compose)

- [ ] `backend/Dockerfile` 作成(gunicorn 起動)
- [ ] `docker-compose.yml` 作成(`web` + `db`)
- [ ] 環境変数を compose に接続
- [ ] `docker compose up` で API + DB が起動することを確認
- [ ] マイグレーション・スーパーユーザー作成を compose 上で実行

---

## Phase 6: フロントエンド(Next.js + shadcn/ui)

### 6.1 環境構築

- [ ] `frontend/` に Next.js 15(App Router / TypeScript)を作成
- [ ] Tailwind CSS 設定
- [ ] shadcn/ui 初期化(Button / Card / Dialog / Form などを追加)
- [ ] TanStack Query / React Hook Form / Zod 導入
- [ ] API クライアント(fetch ラッパ)と JWT 保持の仕組みを実装

### 6.2 認証画面

- [ ] `/register`(新規登録フォーム)
- [ ] `/login`(ログインフォーム、トークン保存)
- [ ] 認証状態に応じたルートガード

### 6.3 投稿機能

- [ ] `/`(ギャラリー一覧、react-photo-album で Masonry 表示)
- [ ] `/posts/[id]`(投稿詳細、Card + Dialog)
- [ ] `/posts/new`(投稿作成、画像プレビュー + 署名付きURLで直PUT)
- [ ] いいねボタン(楽観的更新)

### 6.4 仕上げ

- [ ] 配色は Tailwind デフォルト(stone / amber)、フォントは Geist のまま
- [ ] ローディング / エラー / 空状態の表示
- [ ] レスポンシブ確認

---

## Phase 7: AWS デプロイ(次点重点領域)

### 7.1 準備

- [ ] AWS アカウント / IAM ユーザー / CLI 設定
- [ ] ECR リポジトリ作成、Docker イメージを push

### 7.2 データベース

- [ ] RDS for PostgreSQL 作成
- [ ] Secrets Manager に DB 認証情報を登録
- [ ] セキュリティグループ設定(ECS からのみ接続許可)

### 7.3 バックエンド稼働

- [ ] ECS クラスタ / タスク定義 / サービス作成(Fargate)
- [ ] ALB 作成・ターゲットグループ設定
- [ ] マイグレーションを本番 DB に適用
- [ ] API 疎通確認(ALB 経由)

### 7.4 画像・フロント配信

- [ ] S3 バケット作成(投稿画像用 / フロント配信用)
- [ ] CloudFront ディストリビューション作成(画像 / フロント)
- [ ] S3 は直アクセス禁止(CloudFront 経由のみ)に設定
- [ ] `next build && next export` → S3 同期 → キャッシュ無効化
- [ ] 本番環境で画像アップロード〜表示まで疎通確認

### 7.5 ドメイン / 証明書

- [ ] Route 53 でドメイン設定
- [ ] ACM で SSL 証明書発行・適用

---

## Phase 8: CI/CD

- [ ] GitHub Actions: テスト(pytest / ruff)ワークフロー
- [ ] GitHub Actions: Docker ビルド → ECR push → ECS ローリングデプロイ
- [ ] GitHub Actions: フロント build → S3 同期 → CloudFront 無効化
- [ ] `main` への push で自動デプロイされることを確認

---

## Phase 9(任意): 発展

- [ ] Terraform / AWS CDK で構成をコード化(IaC)
- [ ] CloudWatch Logs でログ収集
- [ ] コメント機能 / プロフィールページ / フォロー機能 / タグ検索
- [ ] 経年変化の時系列記録(同一ブーツの複数写真をまとめる)
