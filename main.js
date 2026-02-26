document.addEventListener('DOMContentLoaded', () => {
  const generateButton = document.getElementById('generate-dinner-menu');
  const dinnerMenuContainer = document.getElementById('dinner-menu-container');
  const themeToggleButton = document.getElementById('theme-toggle');
  const cookieBanner = document.getElementById('cookie-consent-banner');
  const cookieAcceptButton = document.getElementById('cookie-consent-accept');
  const categoryFilter = document.getElementById('category-filter');

  const dinnerMenus = [
    // Korean
    { name: '김치찌개', food_category: 'korean', description: '한국인의 소울푸드, 얼큰하고 깊은 맛' },
    { name: '된장찌개', food_category: 'korean', description: '구수한 맛이 일품인 한국의 전통 찌개' },
    { name: '비빔밥', food_category: 'korean', description: '다양한 나물과 고추장의 환상적인 조화' },
    { name: '삼겹살', food_category: 'korean', description: '지글지글 구워먹는 맛이 일품인 돼지고기' },
    { name: '불고기', food_category: 'korean', description: '달콤한 간장 양념의 소고기 요리' },
    { name: '잡채', food_category: 'korean', description: '쫄깃한 당면과 다양한 채소의 만남' },
    { name: '김치볶음밥', food_category: 'korean', description: '매콤한 김치와 밥의 완벽한 조화, 계란 후라이는 필수!' },
    { name: '제육볶음', food_category: 'korean', description: '매콤달콤한 양념의 돼지고기 볶음, 상추 쌈과 함께하세요' },
    { name: '닭갈비', food_category: 'korean', description: '철판에서 볶아내는 매콤한 닭고기와 야채' },
    { name: '보쌈', food_category: 'korean', description: '부드럽게 삶아낸 돼지고기와 아삭한 보쌈 김치' },
    { name: '순대국', food_category: 'korean', description: '진한 국물과 쫄깃한 순대가 어우러진 든든한 한 끼' },
    { name: '육개장', food_category: 'korean', description: '소고기와 대파를 듬뿍 넣어 얼큰하게 끓여낸 국물 요리' },

    // Japanese
    { name: '초밥', food_category: 'japanese', description: '신선한 해산물과 밥의 예술적인 만남' },
    { name: '라멘', food_category: 'japanese', description: '깊고 진한 국물이 일품인 일본식 라면' },
    { name: '돈까스', food_category: 'japanese', description: '바삭한 튀김옷의 돼지고기 커틀릿' },
    { name: '우동', food_category: 'japanese', description: '따끈하고 쫄깃한 일본식 굵은 국수' },
    { name: '오코노미야끼', food_category: 'japanese', description: '양배추와 다양한 재료를 넣어 구운 일본식 부침개' },
    { name: '야끼소바', food_category: 'japanese', description: '해산물과 야채를 면과 함께 볶아낸 일본식 볶음면' },
    { name: '가츠동', food_category: 'japanese', description: '바삭한 돈가스 위에 계란과 소스를 올린 덮밥' },
    { name: '텐동', food_category: 'japanese', description: '갓 튀겨낸 튀김을 올린 푸짐한 덮밥' },

    // Chinese
    { name: '짜장면', food_category: 'chinese', description: '달콤한 춘장 소스가 매력적인 한국식 중화요리' },
    { name: '짬뽕', food_category: 'chinese', description: '얼큰한 해물 국물이 인상적인 중화요리' },
    { name: '탕수육', food_category: 'chinese', description: '새콤달콤한 소스를 곁들인 돼지고기 튀김' },
    { name: '꿔바로우', food_category: 'chinese', description: '쫄깃한 튀김옷과 새콤한 소스의 만남' },
    { name: '마라탕', food_category: 'chinese', description: '원하는 재료를 골라 담아 얼큰하게 즐기는 마라 요리' },
    { name: '마라샹궈', food_category: 'chinese', description: '매콤한 마라 소스에 볶아낸 중독성 강한 요리' },

    // Western
    { name: '피자', food_category: 'western', description: '치즈와 토핑이 가득한 이탈리안 파이' },
    { name: '햄버거', food_category: 'western', description: '육즙 가득한 패티와 신선한 야채의 조화' },
    { name: '파스타', food_category: 'western', description: '다양한 소스와 함께 즐기는 이탈리안 국수' },
    { name: '스테이크', food_category: 'western', description: '완벽하게 구워진 고급 소고기 요리' },
    { name: '리조또', food_category: 'western', description: '쌀을 소스와 함께 익혀 부드럽고 진한 맛을 낸 이탈리안 요리' },
    { name: '라자냐', food_category: 'western', description: '넓적한 파스타 면 사이에 소스와 치즈를 층층이 쌓아 구운 요리' },
    { name: '샐러드', food_category: 'western', description: '신선한 야채와 드레싱으로 즐기는 가벼운 한 끼' },

    // Etc
    { name: '치킨', food_category: 'etc', description: '바삭하게 튀겨낸 모두의 최애 간식' },
    { name: '떡볶이', food_category: 'etc', description: '매콤달콤한 소스가 매력적인 국민 간식' },
    { name: '카레', food_category: 'etc', description: '향신료의 풍미가 가득한 인도 요리' }
  ];

  // --- Theme Toggler ---
  const applyTheme = () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-mode');
    } else if (savedTheme === 'light') {
      document.body.classList.remove('dark-mode');
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.body.classList.add('dark-mode');
    }
    updateThemeButtonText();
  };

  const updateThemeButtonText = () => {
    if (themeToggleButton) {
        const isDarkMode = document.body.classList.contains('dark-mode');
        themeToggleButton.textContent = isDarkMode ? 'Light Mode' : 'Dark Mode';
    }
  };

  if (themeToggleButton) {
    themeToggleButton.addEventListener('click', () => {
      const isDarkMode = document.body.classList.toggle('dark-mode');
      localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
      updateThemeButtonText();
    });
  }
  
  applyTheme();


  // --- Cookie Consent ---
  if (cookieBanner && cookieAcceptButton) {
    if (!getCookie('cookie_consent')) {
      cookieBanner.classList.add('show');
    }

    cookieAcceptButton.addEventListener('click', () => {
      setCookie('cookie_consent', 'true', 365);
      cookieBanner.classList.remove('show');
    });
  }

  function setCookie(name, value, days) {
    let expires = "";
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/";
  }

  function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i=0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0)==' ') c = c.substring(1,c.length);
      if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
  }

  // --- Dinner Menu Recommendation ---
  if (generateButton && dinnerMenuContainer) {
    generateButton.addEventListener('click', async () => {
      const selectedCategory = categoryFilter.value;
      const menu = recommendDinnerMenu(selectedCategory);
      
      if(menu) {
        displayDinnerMenu(menu); // No await needed as no image fetching
      } else {
        dinnerMenuContainer.innerHTML = `<p>선택하신 카테고리에 메뉴가 없습니다. <br/>다른 카테고리를 선택해주세요!</p>`;
      }
    });
  }

  function recommendDinnerMenu(category) {
    let filteredMenus = dinnerMenus;
    if (category !== 'any') {
      filteredMenus = dinnerMenus.filter(menu => menu.food_category === category);
    }

    if (filteredMenus.length === 0) {
      return null;
    }
    
    const randomIndex = Math.floor(Math.random() * filteredMenus.length);
    return filteredMenus[randomIndex];
  }

  function displayDinnerMenu(menu) {
    dinnerMenuContainer.innerHTML = ''; // Clear previous menu
    const menuItem = document.createElement('div');
    menuItem.className = 'menu-item';
    
    const menuName = document.createElement('div');
    menuName.className = 'menu-name';
    menuName.textContent = menu.name;

    const menuDescription = document.createElement('div');
    menuDescription.className = 'menu-description';
    menuDescription.textContent = menu.description;

    menuItem.appendChild(menuName);
    menuItem.appendChild(menuDescription);
    dinnerMenuContainer.appendChild(menuItem);
  }
});
