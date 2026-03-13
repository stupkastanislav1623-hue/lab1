// Глобальні змінні
let socket;
let grid = [];
let gridWidth = 100;
let gridHeight = 60;
let isConnected = false;
let updateQueue = new Set(); // Черга оновлень для оптимізації

// Ініціалізація при завантаженні сторінки
document.addEventListener('DOMContentLoaded', () => {
    initializeSocket();
    setupEventListeners();
});

// Налаштування Socket.IO
function initializeSocket() {
    socket = io({
        transports: ['websocket'],
        upgrade: false
    });

    // Обробник підключення
    socket.on('connect', () => {
        console.log('Підключено до сервера');
        updateStatus('Підключено до сервера', true);
        isConnected = true;
    });

    // Обробник відключення
    socket.on('disconnect', () => {
        console.log('Відключено від сервера');
        updateStatus('Відключено від сервера. Спроба перепідключення...', false);
        isConnected = false;
    });

    // Отримання початкового стану сітки
    socket.on('state_init', (data) => {
        console.log('Отримано початковий стан:', data);
        gridWidth = data.width || 100;
        gridHeight = data.height || 60;
        grid = data.grid || [];
        
        // Оновлюємо статистику
        updateClientsCount(data.clients_count || 1);
        updateActiveCells();
        
        // Відображаємо сітку
        renderGrid();
        
        updateStatus('Сітку завантажено', true);
    });

    // Оновлення окремої клітинки
    socket.on('cell_updated', (data) => {
        console.log('Оновлення клітинки:', data);
        const { x, y, state } = data;
        
        if (y >= 0 && y < grid.length && x >= 0 && x < grid[y].length) {
            // Оновлюємо локальний стан
            grid[y][x] = state;
            
            // Оновлюємо візуальне відображення
            updateCellVisual(x, y, state);
            
            // Оновлюємо статистику
            updateActiveCells();
        }
    });

    // Оновлення статистики
    socket.on('stats', (data) => {
        updateClientsCount(data.clients_count);
        updateActiveCells(data.active_cells);
    });

    // Обробка помилок
    socket.on('error', (data) => {
        console.error('Помилка від сервера:', data);
        updateStatus('Помилка: ' + data.message, false);
    });
}

// Відображення сітки
function renderGrid() {
    const gridElement = document.getElementById('grid');
    if (!gridElement) return;

    // Очищаємо сітку
    gridElement.innerHTML = '';
    
    // Налаштовуємо CSS Grid
    gridElement.style.gridTemplateColumns = `repeat(${gridWidth}, 1fr)`;
    
    // Створюємо клітинки
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            if (grid[y] && grid[y][x]) {
                cell.classList.add('active');
            }
            
            // Додаємо data атрибути для координат
            cell.dataset.x = x;
            cell.dataset.y = y;
            
            // Додаємо обробник кліку
            cell.addEventListener('click', handleCellClick);
            
            gridElement.appendChild(cell);
        }
    }
}

// Обробник кліку на клітинку
function handleCellClick(event) {
    if (!isConnected) {
        updateStatus('Немає підключення до сервера', false);
        return;
    }
    
    const cell = event.target;
    const x = parseInt(cell.dataset.x);
    const y = parseInt(cell.dataset.y);
    
    // Відправляємо подію на сервер
    socket.emit('toggle_cell', { x, y });
    
    // Візуальний фідбек (оптимістичне оновлення)
    cell.classList.add('cell-clicked');
    setTimeout(() => {
        cell.classList.remove('cell-clicked');
    }, 200);
}

// Оновлення візуального стану клітинки
function updateCellVisual(x, y, state) {
    const gridElement = document.getElementById('grid');
    if (!gridElement) return;
    
    const index = y * gridWidth + x;
    const cell = gridElement.children[index];
    
    if (cell) {
        if (state) {
            cell.classList.add('active');
        } else {
            cell.classList.remove('active');
        }
    }
}

// Оновлення статусу
function updateStatus(message, isConnected) {
    const statusElement = document.getElementById('status');
    if (statusElement) {
        statusElement.textContent = 'Статус: ' + message;
        statusElement.className = 'status ' + (isConnected ? 'connected' : 'disconnected');
    }
}

// Оновлення лічильника клієнтів
function updateClientsCount(count) {
    const countElement = document.getElementById('clients-count');
    if (countElement) {
        countElement.textContent = count;
    }
}

// Підрахунок активних клітинок
function updateActiveCells() {
    const activeCount = grid.reduce((total, row) => {
        return total + row.filter(cell => cell).length;
    }, 0);
    
    const activeElement = document.getElementById('active-cells');
    if (activeElement) {
        activeElement.textContent = activeCount;
    }
}

// Налаштування обробників подій для кнопок
function setupEventListeners() {
    // Кнопка очищення сітки
    const clearBtn = document.getElementById('clear-grid');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (!isConnected) return;
            
            // Очищаємо всі клітинки
            for (let y = 0; y < gridHeight; y++) {
                for (let x = 0; x < gridWidth; x++) {
                    if (grid[y][x]) {
                        socket.emit('toggle_cell', { x, y });
                    }
                }
            }
        });
    }
    
    // Кнопка випадкового заповнення
    const randomBtn = document.getElementById('random-fill');
    if (randomBtn) {
        randomBtn.addEventListener('click', () => {
            if (!isConnected) return;
            
            // Випадково змінюємо 5% клітинок
            const cellsToChange = Math.floor((gridWidth * gridHeight) * 0.05);
            
            for (let i = 0; i < cellsToChange; i++) {
                const x = Math.floor(Math.random() * gridWidth);
                const y = Math.floor(Math.random() * gridHeight);
                socket.emit('toggle_cell', { x, y });
            }
        });
    }
    
    // Кнопка оновлення статистики
    const refreshBtn = document.getElementById('refresh-stats');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            if (isConnected) {
                socket.emit('get_stats');
            }
            updateActiveCells();
        });
    }
}

// Додаємо стиль для анімації кліку
const style = document.createElement('style');
style.textContent = `
    .cell-clicked {
        transform: scale(1.3) !important;
        background: linear-gradient(135deg, #ff6b6b, #ff4757) !important;
        transition: all 0.1s ease !important;
    }
`;
document.head.appendChild(style);

// Експорт функцій для глобального доступу (якщо потрібно)
window.collaborativeGrid = {
    getGridState: () => grid,
    getConnectionStatus: () => isConnected
};