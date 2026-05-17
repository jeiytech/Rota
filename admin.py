from flask import Blueprint, render_template, request, jsonify
from .db import get_db

ad = Blueprint('admin', __name__, url_prefix='/admin')


@ad.route('/')
def index():
    return render_template('admin/employee-add.html')


@ad.route('/staff')
def staff():
    return render_template('admin/employee-add.html')
