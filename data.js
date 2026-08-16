const regions = [
  {
    id:"tokyo", nameEn:"TOKYO", nameKo:"도쿄", nameJp:"東京", eyebrow:"OLD & NEW TOKYO · 3 DAYS",
    headline:["도쿄의 결을","따라 걷는 3일"], intro:["오래된 골목에서 반짝이는 야경까지.","하루에 세 곳, 여유롭게 만나는 도쿄."],
    tipTitle:"스이카 한 장이면 충분해요.", tipText:"지하철과 버스는 물론 편의점에서도 쓸 수 있어 동선을 끊지 않아요.",
    days:[
      { label:"동쪽의 오래된 풍경", title:"아사쿠사에서 긴자까지", transit:"도보 5.2km · 지하철 2회", stops:[
        {time:"09:00",type:"산책",name:"아사쿠사 & 센소지",note:"붐비기 전 나카미세 골목과 오래된 절의 아침을 천천히 만나요.",duration:"2h",lat:35.7148,lon:139.7967},
        {time:"12:30",type:"커피",name:"기요스미시라카와",note:"창고를 개조한 로스터리와 정원이 있는 동네에서 잠깐 쉬어가요.",duration:"2h",lat:35.6797,lon:139.8001},
        {time:"17:00",type:"저녁",name:"긴자 골목",note:"화려한 대로 뒤편, 작은 식당과 오래된 바가 모인 골목을 걸어요.",duration:"3h",lat:35.6717,lon:139.7650}]},
      { label:"느긋한 도쿄의 오후", title:"다이칸야마에서 시부야까지", transit:"도보 6.1km · 전철 1회", stops:[
        {time:"10:00",type:"책과 건축",name:"다이칸야마 T-SITE",note:"햇살 좋은 테라스와 서가 사이에서 여행의 속도를 늦춰요.",duration:"2h",lat:35.6489,lon:139.6990},
        {time:"13:00",type:"산책",name:"나카메구로 강변",note:"작은 숍과 카페를 지나 메구로강을 따라 남쪽으로 걸어요.",duration:"2.5h",lat:35.6436,lon:139.6987},
        {time:"18:00",type:"야경",name:"시부야 스카이",note:"해가 지기 40분 전 도착해 도시의 낮과 밤을 함께 봐요.",duration:"2h",lat:35.6585,lon:139.7022}]},
      { label:"생활의 온도가 남은 곳", title:"야나카에서 가구라자카까지", transit:"도보 4.8km · 지하철 1회", stops:[
        {time:"09:30",type:"골목",name:"야나카 긴자",note:"고양이 조형물과 동네 간식이 반기는 낮은 골목을 걸어요.",duration:"2h",lat:35.7274,lon:139.7667},
        {time:"12:30",type:"미술",name:"우에노 공원",note:"박물관 하나를 골라 깊게 보고, 연못가에서 늦은 점심을 즐겨요.",duration:"3h",lat:35.7155,lon:139.7731},
        {time:"17:30",type:"저녁",name:"가구라자카",note:"돌계단과 작은 요정 골목 사이, 마지막 저녁을 여유롭게 마무리해요.",duration:"3h",lat:35.7020,lon:139.7404}]}
    ]
  },
  {
    id:"kyoto", nameEn:"KYOTO", nameKo:"교토", nameJp:"京都", eyebrow:"ANCIENT CAPITAL · 3 DAYS",
    headline:["천년의 골목을","따라 걷는 교토"], intro:["고요한 절과 작은 골목, 저녁의 등불까지.","시간이 천천히 흐르는 교토를 만나요."],
    tipTitle:"인기 명소는 아침이 가장 좋아요.", tipText:"기요미즈데라와 아라시야마는 오전 9시 전 도착하면 한결 여유롭게 걸을 수 있어요.",
    days:[
      { label:"새벽빛이 머무는 동쪽", title:"기요미즈데라에서 기온까지", transit:"도보 4.3km · 버스 1회", stops:[
        {time:"08:00",type:"사찰",name:"기요미즈데라",note:"산 위 무대에서 교토의 아침 풍경을 먼저 바라봐요.",duration:"2h",lat:34.9949,lon:135.7850},
        {time:"10:30",type:"골목",name:"산넨자카 & 니넨자카",note:"전통 가옥과 작은 찻집 사이의 완만한 돌길을 걸어요.",duration:"2.5h",lat:34.9984,lon:135.7808},
        {time:"17:00",type:"저녁",name:"기온 시라카와",note:"버드나무와 마치야가 이어지는 물가에서 저녁을 맞아요.",duration:"3h",lat:35.0038,lon:135.7763}]},
      { label:"대숲과 강바람", title:"아라시야마의 느린 하루", transit:"도보 4.1km · 전철 1회", stops:[
        {time:"08:30",type:"산책",name:"아라시야마 대나무숲",note:"빛이 부드러운 아침, 높게 뻗은 대숲 사이를 걸어요.",duration:"1.5h",lat:35.0170,lon:135.6713},
        {time:"10:30",type:"정원",name:"텐류지",note:"소겐치 정원의 산과 연못이 만든 차분한 풍경을 즐겨요.",duration:"2h",lat:35.0158,lon:135.6738},
        {time:"15:30",type:"강변",name:"도게츠교",note:"강변 벤치와 작은 카페를 오가며 오후를 천천히 보내요.",duration:"2.5h",lat:35.0124,lon:135.6778}]},
      { label:"붉은 문에서 시장까지", title:"후시미이나리와 교토의 밤", transit:"도보 5.6km · 전철 2회", stops:[
        {time:"07:30",type:"신사",name:"후시미이나리 타이샤",note:"붉은 도리이 길이 조용한 이른 시간에 산책을 시작해요.",duration:"2.5h",lat:34.9671,lon:135.7727},
        {time:"12:00",type:"시장",name:"니시키 시장",note:"교토식 반찬과 간식을 조금씩 맛보며 점심을 즐겨요.",duration:"2.5h",lat:35.0050,lon:135.7649},
        {time:"18:00",type:"저녁",name:"폰토초",note:"가모가와 옆 좁은 골목에서 교토의 마지막 저녁을 보내요.",duration:"3h",lat:35.0051,lon:135.7711}]}
    ]
  },
  {
    id:"osaka", nameEn:"OSAKA", nameKo:"오사카", nameJp:"大阪", eyebrow:"FOOD & NIGHT · 3 DAYS",
    headline:["맛과 밤이","이어지는 오사카"], intro:["시장 골목의 활기에서 반짝이는 전망대까지.","잘 먹고 오래 걷는 오사카의 3일."],
    tipTitle:"오사카에서는 배를 조금 비워 두세요.", tipText:"한 곳에서 많이 먹기보다 시장과 골목의 작은 메뉴를 나누어 맛보는 편이 좋아요.",
    days:[
      { label:"성에서 도시의 불빛까지", title:"오사카성에서 우메다까지", transit:"도보 5.4km · 전철 2회", stops:[
        {time:"09:00",type:"역사",name:"오사카성",note:"해자와 돌담을 따라 걷고 천수각에서 도시를 내려다봐요.",duration:"2.5h",lat:34.6873,lon:135.5262},
        {time:"13:30",type:"골목",name:"나카자키초",note:"오래된 주택을 고친 카페와 빈티지 숍 사이를 둘러봐요.",duration:"2.5h",lat:34.7075,lon:135.5054},
        {time:"18:00",type:"야경",name:"우메다 스카이 빌딩",note:"공중정원에서 오사카의 해 질 녘과 야경을 함께 만나요.",duration:"2h",lat:34.7053,lon:135.4901}]},
      { label:"먹으면서 걷는 미나미", title:"구로몬에서 도톤보리까지", transit:"도보 3.2km · 지하철 1회", stops:[
        {time:"10:00",type:"시장",name:"구로몬 시장",note:"구운 해산물과 과일을 조금씩 맛보며 시장을 돌아봐요.",duration:"2h",lat:34.6654,lon:135.5063},
        {time:"14:00",type:"골목",name:"호젠지 요코초",note:"이끼 낀 석상과 작은 식당이 있는 돌바닥 골목에서 쉬어가요.",duration:"2h",lat:34.6686,lon:135.5020},
        {time:"18:00",type:"야경",name:"도톤보리",note:"강변의 네온과 간판 아래에서 오사카다운 밤을 즐겨요.",duration:"3h",lat:34.6687,lon:135.5013}]},
      { label:"남쪽 동네의 온도", title:"스미요시에서 아베노까지", transit:"도보 4.7km · 트램 1회", stops:[
        {time:"09:30",type:"신사",name:"스미요시 타이샤",note:"아치형 다리와 오래된 신사 건축을 천천히 둘러봐요.",duration:"2h",lat:34.6120,lon:135.4930},
        {time:"13:30",type:"거리",name:"신세카이 & 쓰텐카쿠",note:"복고풍 간판 아래에서 쿠시카츠와 동네 풍경을 즐겨요.",duration:"2.5h",lat:34.6525,lon:135.5063},
        {time:"18:00",type:"전망",name:"아베노 하루카스",note:"도시 남쪽에서 노을과 촘촘한 불빛을 바라봐요.",duration:"2h",lat:34.6457,lon:135.5134}]}
    ]
  },
  {
    id:"fukuoka", nameEn:"FUKUOKA", nameKo:"후쿠오카", nameJp:"福岡", eyebrow:"CITY & COAST · 3 DAYS",
    headline:["도시와 바다가","가까운 후쿠오카"], intro:["공원과 포장마차, 바닷바람 부는 해안까지.","가볍게 움직이고 맛있게 쉬는 3일."],
    tipTitle:"근교 일정에는 교통 시간을 넉넉히 잡아요.", tipText:"다자이후는 전철, 이토시마는 렌터카나 투어를 이용하면 하루가 훨씬 여유로워요.",
    days:[
      { label:"공원에서 포장마차까지", title:"오호리에서 텐진까지", transit:"도보 4.6km · 지하철 1회", stops:[
        {time:"09:00",type:"공원",name:"오호리 공원",note:"넓은 연못 둘레를 걸으며 천천히 하루를 시작해요.",duration:"2h",lat:33.5860,lon:130.3764},
        {time:"11:30",type:"역사",name:"후쿠오카성터",note:"돌담과 전망대에서 공원과 도심을 함께 바라봐요.",duration:"2h",lat:33.5850,lon:130.3832},
        {time:"18:30",type:"저녁",name:"텐진 야타이",note:"작은 포장마차에 앉아 라멘과 꼬치로 밤을 마무리해요.",duration:"3h",lat:33.5902,lon:130.3994}]},
      { label:"학문의 길과 숲", title:"다자이후의 고요한 하루", transit:"도보 5.0km · 전철 2회", stops:[
        {time:"09:30",type:"신사",name:"다자이후 텐만구",note:"참배길의 매화 과자와 오래된 신사 풍경을 만나요.",duration:"2.5h",lat:33.5215,lon:130.5348},
        {time:"13:00",type:"미술",name:"규슈국립박물관",note:"아시아와 일본을 잇는 전시를 여유롭게 둘러봐요.",duration:"2.5h",lat:33.5181,lon:130.5382},
        {time:"16:30",type:"숲",name:"가마도 신사",note:"산기슭의 숲길과 계절 풍경 속에서 하루를 정리해요.",duration:"2h",lat:33.5399,lon:130.5352}]},
      { label:"바다를 따라 서쪽으로", title:"이토시마 해안 드라이브", transit:"차량 이동 62km · 드라이브 추천", stops:[
        {time:"10:00",type:"해변",name:"사쿠라이 후타미가우라",note:"바다 위 부부바위와 흰 도리이가 만든 풍경을 바라봐요.",duration:"2h",lat:33.6400,lon:130.1966},
        {time:"13:00",type:"카페",name:"선셋 로드",note:"해안 카페와 작은 상점을 오가며 느긋하게 점심을 즐겨요.",duration:"2.5h",lat:33.6138,lon:130.1787},
        {time:"16:30",type:"전망",name:"게야노오토",note:"바다 절벽과 소나무 숲이 만나는 이토시마의 서쪽 끝을 만나요.",duration:"2h",lat:33.6017,lon:130.1151}]}
    ]
  },
  {
    id:"sapporo", nameEn:"SAPPORO", nameKo:"삿포로", nameJp:"札幌", eyebrow:"NORTH & NATURE · 3 DAYS",
    headline:["북쪽의 빛을","따라 걷는 삿포로"], intro:["반듯한 도심과 짙은 숲, 항구 도시 오타루까지.","계절의 공기가 선명한 홋카이도 여행."],
    tipTitle:"계절에 맞는 신발이 여행을 바꿔요.", tipText:"겨울에는 미끄럼 방지 밑창을 준비하고, 여름에도 저녁 바람을 위한 얇은 겉옷을 챙겨요.",
    days:[
      { label:"시장의 아침과 도심의 밤", title:"니조시장에서 스스키노까지", transit:"도보 3.8km · 지하철 1회", stops:[
        {time:"08:30",type:"시장",name:"니조시장",note:"신선한 해산물 덮밥으로 홋카이도의 아침을 시작해요.",duration:"2h",lat:43.0578,lon:141.3608},
        {time:"11:30",type:"공원",name:"오도리 공원",note:"계절 꽃과 분수 사이를 걸으며 도심의 넓은 호흡을 느껴요.",duration:"2.5h",lat:43.0605,lon:141.3545},
        {time:"18:00",type:"저녁",name:"스스키노",note:"징기스칸과 미소라멘으로 삿포로의 활기찬 밤을 즐겨요.",duration:"3h",lat:43.0554,lon:141.3532}]},
      { label:"숲에서 내려다본 도시", title:"마루야마에서 모이와산까지", transit:"도보 4.5km · 트램 1회", stops:[
        {time:"09:30",type:"숲",name:"마루야마 공원",note:"큰 나무와 산책로가 이어지는 도심 속 숲을 걸어요.",duration:"2h",lat:43.0555,lon:141.3093},
        {time:"12:00",type:"신사",name:"홋카이도 신궁",note:"고요한 참배길과 북쪽 특유의 넓은 경내를 둘러봐요.",duration:"2h",lat:43.0542,lon:141.3077},
        {time:"17:00",type:"야경",name:"모이와산 전망대",note:"로프웨이를 타고 올라가 노을과 삿포로 야경을 함께 봐요.",duration:"2.5h",lat:43.0244,lon:141.3222}]},
      { label:"운하와 창고의 시간", title:"오타루로 떠나는 하루", transit:"도보 5.1km · JR 왕복", stops:[
        {time:"10:00",type:"운하",name:"오타루 운하",note:"석조 창고와 잔잔한 물길을 따라 항구 도시의 아침을 걸어요.",duration:"2h",lat:43.1990,lon:140.9947},
        {time:"13:00",type:"거리",name:"사카이마치 거리",note:"유리 공방과 오르골 상점, 디저트 가게를 천천히 둘러봐요.",duration:"3h",lat:43.1965,lon:141.0023},
        {time:"17:00",type:"전망",name:"텐구산 로프웨이",note:"바다와 오타루 시가지가 한눈에 보이는 산 위에서 하루를 마쳐요.",duration:"2h",lat:43.1770,lon:140.9714}]}
    ]
  }
];
