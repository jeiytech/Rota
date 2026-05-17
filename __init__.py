import os
from flask import Flask
from Rota import db


def create_app(test_config=None):
    app = Flask(__name__, instance_relative_config=True)

    app.config.from_mapping(
        SECRET_KEY='dev-secret-key-change-in-production',
        DATABASE=os.path.join(app.instance_path, 'rota.sqlite'),
        # Email config (update with real SMTP credentials)
        MAIL_SERVER=os.environ.get('MAIL_SERVER', 'smtp.gmail.com'),
        MAIL_PORT=int(os.environ.get('MAIL_PORT', 587)),
        MAIL_USERNAME=os.environ.get('MAIL_USERNAME', ''),
        MAIL_PASSWORD=os.environ.get('MAIL_PASSWORD', ''),
        MAIL_USE_TLS=True,
    )

    if test_config is None:
        app.config.from_pyfile('config.py', silent=True)
    else:
        app.config.from_mapping(test_config)

    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    db.init_app(app)

    from . import user, admin
    app.register_blueprint(user.us)
    app.register_blueprint(admin.ad)

    # Auto-init DB on first run
    with app.app_context():
        try:
            db.init_db()
        except Exception:
            pass

    return app
