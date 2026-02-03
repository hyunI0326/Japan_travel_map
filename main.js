document.addEventListener('DOMContentLoaded', () => {
  const generateButton = document.getElementById('generate-dinner-menu');
  const dinnerMenuContainer = document.getElementById('dinner-menu-container');
  const themeToggleButton = document.getElementById('theme-toggle');
  const cookieBanner = document.getElementById('cookie-consent-banner');
  const cookieAcceptButton = document.getElementById('cookie-consent-accept');
  const categoryFilter = document.getElementById('category-filter');

  const dinnerMenus = [
    // Korean
    { name: '김치찌개', food_category: 'korean', api_category: 'kimchi-jjigae', description: '한국인의 소울푸드, 얼큰하고 깊은 맛' },
    { name: '된장찌개', food_category: 'korean', api_category: 'doenjang-jjigae', description: '구수한 맛이 일품인 한국의 전통 찌개' },
    { name: '비빔밥', food_category: 'korean', api_category: 'bibimbap', description: '다양한 나물과 고추장의 환상적인 조화' },
    { name: '삼겹살', food_category: 'korean', api_category: 'samgyeopsal', description: '지글지글 구워먹는 맛이 일품인 돼지고기' },
    { name: '불고기', food_category: 'korean', api_category: 'bulgogi', description: '달콤한 간장 양념의 소고기 요리' },
    { name: '잡채', food_category: 'korean', api_category: 'japchae', description: '쫄깃한 당면과 다양한 채소의 만남' },

    // Japanese
    { name: '초밥', food_category: 'japanese', api_category: 'sushi', description: '신선한 해산물과 밥의 예술적인 만남' },
    { name: '라멘', food_category: 'japanese', api_category: 'ramen', description: '깊고 진한 국물이 일품인 일본식 라면' },
    { name: '돈까스', food_category: 'japanese', api_category: 'donkatsu', description: '바삭한 튀김옷의 돼지고기 커틀릿' },
    { name: '우동', food_category: 'japanese', api_category: 'udon', description: '따끈하고 쫄깃한 일본식 굵은 국수' },

    // Chinese
    { name: '짜장면', food_category: 'chinese', api_category: 'jjajangmyeon', description: '달콤한 춘장 소스가 매력적인 한국식 중화요리' },
    { name: '짬뽕', food_category: 'chinese', api_category: 'jjamppong', description: '얼큰한 해물 국물이 인상적인 중화요리' },
    { name: '탕수육', food_category: 'chinese', api_category: 'tangsuyuk', description: '새콤달콤한 소스를 곁들인 돼지고기 튀김' },

    // Western
    { name: '피자', food_category: 'western', api_category: 'pizza', description: '치즈와 토핑이 가득한 이탈리안 파이' },
    { name: '햄버거', food_category: 'western', api_category: 'burger', description: '육즙 가득한 패티와 신선한 야채의 조화' },
    { name: '파스타', food_category: 'western', api_category: 'pasta', description: '다양한 소스와 함께 즐기는 이탈리안 국수' },
    { name: '스테이크', food_category: 'western', api_category: 'steak', description: '완벽하게 구워진 고급 소고기 요리' },

    // Etc
    { name: '치킨', food_category: 'etc', api_category: 'chicken', description: '바삭하게 튀겨낸 모두의 최애 간식' },
    { name: '떡볶이', food_category: 'etc', api_category: 'tteokbokki', description: '매콤달콤한 소스가 매력적인 국민 간식' },
    { name: '카레', food_category: 'etc', api_category: 'curry', description: '향신료의 풍미가 가득한 인도 요리' }
  ];

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
        await displayDinnerMenu(menu);
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

  async function displayDinnerMenu(menu) {
    dinnerMenuContainer.innerHTML = '<div class="loader"></div>'; // Show loader

    try {
        const imageUrl = await getFoodImage(menu.api_category);

        dinnerMenuContainer.innerHTML = ''; // Clear previous menu
        const menuItem = document.createElement('div');
        menuItem.className = 'menu-item';
        
        const menuImage = document.createElement('img');
        menuImage.src = imageUrl;
        menuImage.alt = menu.name;

        const menuName = document.createElement('div');
        menuName.className = 'menu-name';
        menuName.textContent = menu.name;

        const menuDescription = document.createElement('div');
        menuDescription.className = 'menu-description';
        menuDescription.textContent = menu.description;

        menuItem.appendChild(menuImage);
        menuItem.appendChild(menuName);
        menuItem.appendChild(menuDescription);
        dinnerMenuContainer.appendChild(menuItem);

    } catch (error) {
        console.error('Error fetching food image:', error);
        dinnerMenuContainer.innerHTML = `<p>이미지를 불러오는 데 실패했습니다. <br/><strong>${menu.name}</strong> 어떠세요?</p>`;
    }
  }

  async function getFoodImage(category) {
    const availableCategories = ['burger', 'pizza', 'pasta', 'steak', 'sushi', 'ramen', 'chicken'];
    let fetchCategory = category;

    // Use a generic food image if the specific category isn't in the API's list
    if (!availableCategories.includes(fetchCategory)) {
        fetchCategory = 'food';
    }

    try {
        const response = await fetch(`https://foodish-api.com/api/images/${fetchCategory}/`);
        if (!response.ok) {
            // Fallback to the generic food endpoint if the specific category fails
            const fallbackResponse = await fetch('https://foodish-api.com/api/');
            const fallbackData = await fallbackResponse.json();
            return fallbackData.image;
        }
        const data = await response.json();
        return data.image;
    } catch (error) {
        console.warn(`Could not fetch from Foodish API. Using placeholder.`);
        // A reliable, appealing placeholder image
        return `https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1`;
    }
  }


  // --- Theme Toggler ---
  if (themeToggleButton) {
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
