# 作業時の再発防止ルール

- Django コマンドはターミナルの現在ディレクトリに依存させない。リポジトリ直下から `uv run --project backend python backend/manage.py <command>` の形式で実行する。
- 編集前に対象の近くにある設定・実装例を確認し、変更する範囲と最初の検証コマンドを決める。アプリを追加するときは既存アプリの `apps.py` と `INSTALLED_APPS` の書き方を揃える。
- 最初の編集後は対象を絞った検証を一度実行する。成功した検証は、その後コードを変えていない限り繰り返さない。
- migration が必要な変更では `makemigrations`、`migrate`、最後に `makemigrations --check --dry-run` を実行する。DB 適用済みの確認を重複して行わない。
- Django のテストクライアントで HTTP リクエストを確認するときは `ALLOWED_HOSTS` に合う Host を指定する。この環境では `HTTP_HOST="localhost"` を使い、テスト用 Host を理由に本番設定を緩めない。
- コマンドがバックグラウンド扱いになった場合は同じ実行の結果を取得し、完了前に同じコマンドを再実行しない。
- 既存の未コミット変更は保持し、依頼範囲外のファイルを変更しない。
