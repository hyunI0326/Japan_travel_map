document.addEventListener('DOMContentLoaded', () => {
  const generateButton = document.getElementById('generate-lotto-numbers');
  const lottoNumbersContainer = document.getElementById('lotto-numbers-container');
  const themeToggleButton = document.getElementById('theme-toggle');

  // --- Lotto Number Generation ---
  if (generateButton && lottoNumbersContainer) {
    generateButton.addEventListener('click', () => {
      const numbers = generateLottoNumbers();
      displayLottoNumbers(numbers);
    });
  }

  function generateLottoNumbers() {
    const numbers = new Set();
    while (numbers.size < 6) {
      const randomNumber = Math.floor(Math.random() * 45) + 1;
      numbers.add(randomNumber);
    }
    return Array.from(numbers).sort((a, b) => a - b);
  }

  function displayLottoNumbers(numbers) {
    lottoNumbersContainer.innerHTML = ''; // Clear previous numbers
    numbers.forEach((number, index) => {
      setTimeout(() => {
        const ball = document.createElement('div');
        ball.className = 'lotto-ball';
        ball.textContent = number;
        lottoNumbersContainer.appendChild(ball);
      }, index * 100); // Stagger the animation
    });
  }

  // --- Theme Toggler ---
  if (themeToggleButton) {
    // Set initial theme based on user preference if available
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      document.body.classList.add('dark-mode');
    }
    updateThemeButtonText();

    themeToggleButton.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      updateThemeButtonText();
    });
  }
  
  function updateThemeButtonText() {
    const isDarkMode = document.body.classList.contains('dark-mode');
    themeToggleButton.textContent = isDarkMode ? 'Light Mode' : 'Dark Mode';
  }
});

