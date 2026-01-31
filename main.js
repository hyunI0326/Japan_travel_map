document.addEventListener('DOMContentLoaded', () => {
  const generateButton = document.getElementById('generate-lotto-numbers');
  const lottoNumbersDiv = document.getElementById('lotto-numbers');
  const themeToggleButton = document.getElementById('theme-toggle');

  if (generateButton && lottoNumbersDiv) {
    generateButton.addEventListener('click', () => {
      const numbers = generateLottoNumbers();
      lottoNumbersDiv.textContent = `생성된 로또 번호: ${numbers.join(', ')}`;
    });
  }

  if (themeToggleButton) {
    themeToggleButton.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      const isDarkMode = document.body.classList.contains('dark-mode');
      themeToggleButton.textContent = isDarkMode ? 'Toggle Light Mode' : 'Toggle Dark Mode';
    });
  }

  function generateLottoNumbers() {
    const numbers = new Set();
    while (numbers.size < 6) {
      const randomNumber = Math.floor(Math.random() * 45) + 1; // Numbers from 1 to 45
      numbers.add(randomNumber);
    }
    return Array.from(numbers).sort((a, b) => a - b);
  }
});
