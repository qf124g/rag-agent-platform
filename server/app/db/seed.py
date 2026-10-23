import random
import sqlite3
from datetime import date, timedelta

from app.config import settings

# 建表语句，同时作为 schema 描述注入 Agent 的 system prompt
SCHEMA_SQL = """
CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,            -- 商品名称
    category TEXT NOT NULL,        -- 商品分类
    unit_price REAL NOT NULL       -- 单价（元）
);

CREATE TABLE customers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,            -- 客户名称
    level TEXT NOT NULL,           -- 客户等级：普通 / 银卡 / 金卡 / 钻石
    city TEXT NOT NULL             -- 所在城市
);

CREATE TABLE orders (
    id INTEGER PRIMARY KEY,
    order_no TEXT NOT NULL,        -- 订单编号
    product_id INTEGER NOT NULL REFERENCES products(id),
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    quantity INTEGER NOT NULL,     -- 购买数量
    amount REAL NOT NULL,          -- 订单金额（元）
    status TEXT NOT NULL,          -- 订单状态：已完成 / 已发货 / 待付款 / 已取消
    created_at TEXT NOT NULL       -- 下单日期，格式 YYYY-MM-DD
);
"""

_PRODUCTS = [
    ("智能手表 Pro", "数码电子", 1599.0),
    ("无线降噪耳机", "数码电子", 899.0),
    ("机械键盘 K87", "数码电子", 499.0),
    ("人体工学椅", "家居办公", 1899.0),
    ("升降办公桌", "家居办公", 2499.0),
    ("护眼台灯", "家居办公", 299.0),
    ("保温杯 500ml", "生活百货", 129.0),
    ("乳胶枕", "生活百货", 259.0),
    ("筋膜枪", "运动健康", 699.0),
    ("瑜伽垫", "运动健康", 99.0),
    ("跑步鞋", "运动健康", 599.0),
    ("咖啡机", "厨房电器", 1299.0),
    ("空气炸锅", "厨房电器", 399.0),
    ("破壁机", "厨房电器", 799.0),
]

_CITIES = ["北京", "上海", "广州", "深圳", "杭州", "成都", "武汉", "西安"]
_LEVELS = ["普通", "银卡", "金卡", "钻石"]
_STATUSES = ["已完成", "已完成", "已完成", "已发货", "待付款", "已取消"]  # 已完成占比更高
_SURNAMES = "王李张刘陈杨黄赵周吴徐孙马朱胡郭何"


def init_biz_db() -> None:
    """首次启动时生成示例业务库，已存在则跳过"""
    db_path = settings.biz_db_path
    if db_path.exists():
        return

    conn = sqlite3.connect(db_path)
    try:
        conn.executescript(SCHEMA_SQL)
        rng = random.Random(42)

        products = [(i + 1, *p) for i, p in enumerate(_PRODUCTS)]
        conn.executemany("INSERT INTO products VALUES (?, ?, ?, ?)", products)

        customers = [
            (i + 1, f"{rng.choice(_SURNAMES)}{rng.choice('伟芳娜敏静丽强磊军洋勇艳杰娟涛明超')}",
             rng.choice(_LEVELS), rng.choice(_CITIES))
            for i in range(50)
        ]
        conn.executemany("INSERT INTO customers VALUES (?, ?, ?, ?)", customers)

        # 生成近一年的订单数据
        start = date.today() - timedelta(days=365)
        orders = []
        for i in range(600):
            product = rng.choice(products)
            quantity = rng.randint(1, 8)
            created = start + timedelta(days=rng.randint(0, 364))
            orders.append((
                i + 1,
                f"SO{created.strftime('%Y%m%d')}{i:04d}",
                product[0],
                rng.randint(1, len(customers)),
                quantity,
                round(product[3] * quantity, 2),
                rng.choice(_STATUSES),
                created.isoformat(),
            ))
        conn.executemany("INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?, ?)", orders)
        conn.commit()
    finally:
        conn.close()
