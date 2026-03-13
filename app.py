from flask import Flask, render_template
from flask_socketio import SocketIO, emit, disconnect
import logging
import random

# Налаштування логування
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = 'collaborative-grid-secret-key'
socketio = SocketIO(app, cors_allowed_origins="*")

# Розміри сітки
GRID_WIDTH = 100
GRID_HEIGHT = 60

# Зберігання стану сітки в пам'яті процесу
# Використовуємо список списків (False - вимкнено, True - увімкнено)
grid_state = [[False for _ in range(GRID_WIDTH)] for _ in range(GRID_HEIGHT)]

# Лічильник підключених клієнтів
connected_clients = 0

def validate_coordinates(x, y):
    """
    Валідація координат клітинки
    """
    try:
        x = int(x)
        y = int(y)
        if 0 <= x < GRID_WIDTH and 0 <= y < GRID_HEIGHT:
            return True, x, y
        else:
            return False, None, None
    except (ValueError, TypeError):
        return False, None, None

@app.route('/')
def index():
    """Головна сторінка"""
    return render_template('index.html')

@socketio.on('connect')
def handle_connect():
    """
    Обробник підключення нового клієнта
    """
    global connected_clients
    connected_clients += 1
    client_id = request.sid
    logger.info(f'Клієнт підключився. ID: {client_id}, Всього клієнтів: {connected_clients}')
    
    # Відправляємо повний поточний стан сітки новому клієнту
    emit('state_init', {
        'grid': grid_state,
        'width': GRID_WIDTH,
        'height': GRID_HEIGHT,
        'clients_count': connected_clients
    })

@socketio.on('disconnect')
def handle_disconnect():
    """
    Обробник відключення клієнта
    """
    global connected_clients
    connected_clients -= 1
    logger.info(f'Клієнт відключився. Залишилось клієнтів: {connected_clients}')

@socketio.on('toggle_cell')
def handle_toggle_cell(data):
    """
    Обробник зміни стану клітинки
    """
    try:
        x = data.get('x')
        y = data.get('y')
        
        # Валідація координат
        is_valid, valid_x, valid_y = validate_coordinates(x, y)
        
        if not is_valid:
            logger.warning(f'Отримано невалідні координати: x={x}, y={y}')
            emit('error', {'message': 'Невалідні координати клітинки'})
            return
        
        # Змінюємо стан клітинки
        current_state = grid_state[valid_y][valid_x]
        new_state = not current_state
        grid_state[valid_y][valid_x] = new_state
        
        logger.info(f'Клітинка змінена: ({valid_x}, {valid_y}) -> {new_state}')
        
        # Транслюємо зміну всім підключеним клієнтам
        emit('cell_updated', {
            'x': valid_x,
            'y': valid_y,
            'state': new_state
        }, broadcast=True)
        
    except Exception as e:
        logger.error(f'Помилка при обробці toggle_cell: {str(e)}')
        emit('error', {'message': 'Внутрішня помилка сервера'})

@socketio.on('get_stats')
def handle_get_stats():
    """
    Відправка статистики клієнту
    """
    emit('stats', {
        'clients_count': connected_clients,
        'active_cells': sum(sum(row) for row in grid_state)
    })

# Додаємо request для доступу до sid
from flask import request

if __name__ == '__main__':
    logger.info(f'Запуск Collaborative Grid сервера...')
    logger.info(f'Розмір сітки: {GRID_WIDTH}x{GRID_HEIGHT}')
    logger.info(f'Доступ за адресою: http://localhost:5000')
    socketio.run(app, debug=True, allow_unsafe_werkzeug=True)