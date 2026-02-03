document.addEventListener('DOMContentLoaded', () => {
  const generateButton = document.getElementById('generate-dinner-menu');
  const dinnerMenuContainer = document.getElementById('dinner-menu-container');
  const themeToggleButton = document.getElementById('theme-toggle');

  const dinnerMenus = [
    '한식', '중식', '일식', '양식', '분식', '치킨', '피자', '햄버거', '샌드위치', '샐러드', '파스타', '스테이크', '초밥', '라멘', '우동', '돈까스', '회', '곱창', '막창', '대창', '삼겹살', '갈비', '불고기', '백반', '김치찌개', '된장찌개', '부대찌개', '순두부찌개', '청국장', '동태찌개', '갈비탕', '설렁탕', '곰탕', '육개장', '감자탕', '추어탕', '삼계탕', '보쌈', '족발', '아구찜', '해물찜', '닭갈비', '찜닭', '닭볶음탕', '오리주물럭', '오리백숙', '장어구이', '꼼장어', '조개구이', '대게', '킹크랩', '랍스터', '새우구이', '전복죽', '낙지볶음', '오징어볶음', '주꾸미볶음', '코다리찜', '갈치조림', '고등어조림', '꽁치조림', '두부조림', '계란찜', '잡채', '전', '튀김', '만두', '국수', '냉면', '칼국수', '수제비', '떡볶이', '순대', '김밥', '라면', '쫄면', '비빔밥', '김치볶음밥', '오므라이스', '카레', '짜장면', '짬뽕', '탕수육', '깐풍기', '양장피', '팔보채', '마라탕', '마라샹궈', '훠궈', '쌀국수', '분짜', '팟타이', '나시고랭', '미고랭', '타코', '부리또', '퀘사디아', '화이타', '스테이크', '피자', '파스타', '리조또', '필라프', '샐러드', '샌드위치', '햄버거', '핫도그', '토스트'
  ];

  // --- Dinner Menu Recommendation ---
  if (generateButton && dinnerMenuContainer) {
    generateButton.addEventListener('click', () => {
      const menu = recommendDinnerMenu();
      displayDinnerMenu(menu);
    });
  }

  function recommendDinnerMenu() {
    const randomIndex = Math.floor(Math.random() * dinnerMenus.length);
    return dinnerMenus[randomIndex];
  }

  function displayDinnerMenu(menu) {
    dinnerMenuContainer.innerHTML = ''; // Clear previous menu
    const menuItem = document.createElement('div');
    menuItem.className = 'menu-item';
    menuItem.textContent = menu;
    dinnerMenuContainer.appendChild(menuItem);
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