async function updateUI() {
    try {
        const response = await fetch('/api/state');
        if (!response.ok) throw new Error('Network error');
        const state = await response.json();

        document.querySelectorAll('.button').forEach(button => {
            const side = button.dataset.side;
            const direction = button.dataset.direction;

            let isActive = false;

            if(direction == "stop" && state.isMoving == true) isActive = true;

            const isForward = direction === 'forward';

            if (side === 'L') isActive = state.left === (isForward ? 1 : -1);
            if (side === 'R') isActive = state.right === (isForward ? 1 : -1);
            if (side === 'A' && direction != "stop") isActive = state.left === (isForward ? 1 : -1) && state.right === (isForward ? 1 : -1);

            button.className = `button ${isActive ? (isForward ? 'forward-active' : (direction != 'stop' ? 'back-active' : "stop")) : ''}`;

        });

        document.getElementById('status').textContent =
            `Current state: Left=${state.left == 0 ? 'stop' : state.left == 1 ? 'forward' : 'back'}, Right=${state.right == 0 ? 'stop' : state.right == 1 ? 'forward' : 'back'}`;
    } catch (error) {
        console.error('UI update failed:', error);
        document.getElementById('status').textContent = 'Error fetching state';
    }
}

async function setDirection(side, direction) {
    try {
        const response = await fetch('/api/control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ side, direction })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Unknown error');
        }

        await updateUI();
    } catch (error) {
        console.error('Error:', error);
        alert(`Error: ${error.message}`);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.button').forEach(button => {
        button.addEventListener('click', () => {
            const side = button.dataset.side;
            const direction = button.dataset.direction;
            setDirection(side, direction);
        });
    });
    updateUI();
    setInterval(updateUI, 5000);
});