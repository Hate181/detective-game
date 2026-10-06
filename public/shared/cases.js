/* Архив дел. Каждое дело задаёт сцену, жертву, места для алиби и профессии с тегами для улик. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./content.js'), require('./case-content.js'));
  else root.DetectiveCases = factory(root.DetectiveContent, root.DetectiveCaseContent);
})(typeof self !== 'undefined' ? self : this, function (Content, Extra) {
  const P = (name, ...tags) => ({ name, tags });

  const CASES = [
    {
      id: 'lyra', title: 'Премьера в театре «Лира»', short: 'Театр', icon: 'theatre', year: '1913', difficulty: 2,
      victim: 'Аделаида Корвин, примадонна', time: '21:35',
      teaser: 'Во втором акте Корвин не вышла на поклон. Гримёрную нашли запертой изнутри, а лампы над зеркалом горели, будто хозяйка вот-вот вернётся. Дежурный клянётся, что в кулисах мелькали двое, но лиц не разглядел.',
      locations: ['Сцена', 'Гримёрная примадонны', 'Оркестровая яма', 'Колосники', 'Буфет', 'Костюмерная', 'Директорская ложа'], scene: 'Гримёрная примадонны',
      professions: [
        P('Суфлёр', 'quiet', 'sched'), P('Машинист сцены', 'tech', 'strong'), P('Костюмер', 'tools', 'keys'), P('Гример', 'perfume'),
        P('Дирижёр', 'lefty'), P('Директор театра', 'safe', 'keys'), P('Билетёр', 'passages', 'sched'), P('Осветитель', 'tech'),
        P('Балетмейстер', 'strong'), P('Театральный критик', 'french'), P('Тенор-дублёр', 'french', 'quiet'), P('Пожарный дежурный', 'keys', 'sched'),
        P('Бутафор', 'tools'), P('Кассир', 'cash', 'safe'), P('Скрипач оркестра', 'quiet'), P('Режиссёр', 'sched'),
        P('Театральный врач', 'medic'), P('Швея', 'tools'),
      ],
      enabled: true,
    },
    {
      id: 'passage', title: 'Отель «Пассаж»', short: 'Отель', icon: 'hotel', year: '1938', difficulty: 2,
      victim: 'Маркус Штайн, постоялец седьмого номера', time: '00:15',
      teaser: 'Постоялец седьмого номера заказал в полночь чай, но дверь на стук не открылась. Ночной портье уверяет, что из холла никто не выходил, зато на чёрной лестнице остались мокрые следы. Один гость, похоже, пришёл с улицы, а другой уже ждал внутри.',
      locations: ['Холл', 'Седьмой номер', 'Чёрная лестница', 'Бельевая', 'Ресторан', 'Подвал с котельной', 'Крыша'], scene: 'Седьмой номер',
      professions: [
        P('Ночной портье', 'keys', 'sched'), P('Коридорный', 'passages', 'quiet'), P('Горничная', 'keys', 'passages'), P('Повар', 'tools'),
        P('Управляющий', 'safe', 'keys'), P('Кочегар', 'strong', 'tools'), P('Официант', 'quiet'), P('Швейцар', 'strong'),
        P('Кассир', 'cash', 'safe'), P('Гость-коммерсант', 'cash'), P('Гостья-певица', 'perfume'), P('Врач из соседнего номера', 'medic'),
        P('Электрик', 'tech', 'tools'), P('Шофёр', 'driver', 'strong'), P('Билетёр из казино', 'passages'), P('Адвокат', 'french', 'safe'),
        P('Прачка', 'keys'), P('Владелец отеля', 'safe', 'cash'),
      ],
      enabled: true,
    },
    {
      id: 'moonstone', title: 'Ювелирный дом «Лунный камень»', short: 'Ювелиры', icon: 'bank', year: '1947', difficulty: 3,
      victim: 'Соломон Эйдельман, старший мастер', time: '19:40',
      teaser: 'Витрину открыли родным ключом, а самый дорогой гарнитур остался нетронутым. Пропали чертежи нового колье, а вместе с ними погиб мастер Эйдельман. Полиция считает, что работали вдвоём: один отвлекал, а второй знал, где что лежит.',
      locations: ['Мастерская', 'Торговый зал', 'Сейфовая комната', 'Кабинет владельца', 'Склад камней', 'Чёрный ход', 'Контора'], scene: 'Мастерская',
      professions: [
        P('Ювелир-гравёр', 'tools', 'glasses'), P('Огранщик', 'tools'), P('Кассир', 'cash', 'safe'), P('Приказчик', 'keys', 'cash'),
        P('Владелец дома', 'safe', 'keys'), P('Оценщик', 'cash', 'glasses'), P('Сторож', 'keys', 'sched'), P('Курьер', 'driver', 'passages'),
        P('Бухгалтер', 'safe', 'cash'), P('Эксперт-геммолог', 'french', 'tools'), P('Страховой инспектор', 'safe'), P('Часовщик', 'tools', 'tech'),
        P('Постоянная покупательница', 'perfume', 'french'), P('Резчик по кости', 'tools'), P('Грузчик', 'strong'), P('Агент по продаже', 'cash'),
        P('Электрик', 'tech'), P('Подмастерье', 'quiet', 'passages'),
      ],
      enabled: true,
    },
    {
      id: 'orion', title: 'Обсерватория «Орион»', short: 'Обсерватория', icon: 'mountain', year: '1954', difficulty: 3,
      victim: 'Профессор Леон Вальтер, директор обсерватории', time: '03:05',
      teaser: 'Снегопад отрезал дорогу вниз, и ночная смена осталась на вершине. Профессор лежит у телескопа, купол закрыт, а в журнале наблюдений нет записи о последнем часе. Кто-то стёр её и притворился, что всю ночь следил за небом.',
      locations: ['Купол телескопа', 'Лаборатория', 'Библиотека', 'Столовая', 'Генераторная', 'Гостевые комнаты', 'Лестница на вершину'], scene: 'Купол телескопа',
      professions: [
        P('Астроном-наблюдатель', 'tech', 'late'), P('Лаборант', 'tools'), P('Хранитель библиотеки', 'quiet', 'french'), P('Повар', 'tools'),
        P('Механик купола', 'tech', 'strong'), P('Метеоролог', 'tech', 'sched'), P('Секретарь директора', 'keys', 'safe'), P('Врач обсерватории', 'medic'),
        P('Радист', 'tech'), P('Альпинист-проводник', 'strong', 'passages'), P('Приезжий журналист', 'french'), P('Электрик', 'tech', 'tools'),
        P('Уборщик', 'keys', 'passages'), P('Аспирант', 'late'), P('Завхоз', 'keys', 'cash'), P('Картограф', 'glasses'),
        P('Преподаватель астрономии', 'french'), P('Попечитель-меценат', 'cash'),
      ],
      enabled: true,
    },
    {
      id: 'sweetbird', title: 'Кондитерская фабрика «Сладкая птица»', short: 'Фабрика', icon: 'generic', year: '1962', difficulty: 1,
      victim: 'Гедеон Ромашкин, основатель фабрики', time: '04:20',
      teaser: 'В ночную смену на фабрике пахнет ванилью, поэтому горький запах из цеха глазури никто не заметил. Утром основателя нашли у остывшего котла. Рецепт нового пралине исчез вместе с ним, и теперь ищут не только убийцу, но и вора.',
      locations: ['Цех глазури', 'Склад сырья', 'Упаковочная', 'Кабинет основателя', 'Лаборатория вкуса', 'Погрузочная', 'Проходная'], scene: 'Цех глазури',
      professions: [
        P('Кондитер-технолог', 'tools', 'candy'), P('Мастер смены', 'keys', 'sched'), P('Грузчик', 'strong'), P('Инженер по оборудованию', 'tech', 'tools'),
        P('Бухгалтер фабрики', 'safe', 'cash'), P('Дегустатор', 'candy'), P('Водитель-экспедитор', 'driver', 'passages'), P('Сторож на проходной', 'keys', 'sched'),
        P('Заведующий складом', 'keys', 'cash'), P('Химик-лаборант', 'medic', 'tools'), P('Упаковщица', 'quiet'), P('Начальник охраны', 'strong', 'keys'),
        P('Секретарь основателя', 'safe', 'keys'), P('Рекламный агент', 'french'), P('Санитарный врач', 'medic'), P('Уборщик', 'passages', 'quiet'),
        P('Механик погрузчика', 'tools', 'driver'), P('Наследник семейного дела', 'cash'),
      ],
      enabled: true,
    },
    {
      id: 'linden', title: 'Свадьба в поместье «Липовая аллея»', short: 'Свадьба', icon: 'mansion', year: '1925', difficulty: 2,
      victim: 'Артемий Волынский, отец невесты', time: '23:10',
      teaser: 'Гости только подняли бокалы, а отец невесты ушёл в кабинет за письмом, которое хотел прочесть в тосте. Письмо исчезло, а отец остался в кабинете навсегда. Теперь вся свадьба сидит в зале и поглядывает друг на друга.',
      locations: ['Танцевальный зал', 'Кабинет отца невесты', 'Липовая аллея', 'Каретный сарай', 'Кухня', 'Беседка', 'Библиотека'], scene: 'Кабинет отца невесты',
      professions: [
        P('Дворецкий', 'keys', 'passages'), P('Шафер жениха', 'strong'), P('Подруга невесты', 'perfume', 'french'), P('Повар', 'tools'),
        P('Тамада', 'whistle'), P('Священник', 'quiet'), P('Нотариус семьи', 'safe', 'cash'), P('Садовник', 'tools', 'strong'),
        P('Кучер', 'driver', 'strong'), P('Тётушка жениха', 'perfume'), P('Домашний врач', 'medic'), P('Музыкант', 'quiet'),
        P('Фотограф', 'tech'), P('Управляющий имением', 'keys', 'safe'), P('Дальний родственник', 'cane'), P('Горничная', 'keys', 'quiet'),
        P('Конюх', 'strong', 'tools'), P('Крёстный отец жениха', 'cash'),
      ],
      enabled: true,
    },
    {
      id: 'ferry', title: 'Паром «Северный»', short: 'Паром', icon: 'steamboat', year: '1959', difficulty: 3,
      victim: 'Ян Бергстрём, инспектор порта', time: '02:50',
      teaser: 'Паром третьи сутки идёт без остановок, потому что порт закрыт штормом. Инспектора порта нашли в автомобильном трюме, хотя его каюта запиралась изнутри. Ключи были у троих, а на инспекторе остались следы двух разных людей.',
      locations: ['Салон', 'Палуба', 'Автомобильный трюм', 'Машинное отделение', 'Каюта инспектора', 'Буфет', 'Рулевая рубка'], scene: 'Автомобильный трюм',
      professions: [
        P('Капитан', 'keys', 'sched'), P('Старший помощник', 'sched', 'keys'), P('Матрос', 'strong', 'passages'), P('Механик', 'tech', 'tools'),
        P('Буфетчик', 'cash', 'keys'), P('Стюардесса', 'keys', 'perfume'), P('Радист', 'tech'), P('Врач парома', 'medic'),
        P('Водитель грузовика', 'driver', 'strong'), P('Пассажир-торговец', 'cash'), P('Таможенный чиновник', 'safe', 'keys'), P('Корреспондент', 'french'),
        P('Кок', 'tools'), P('Пассажир с тростью', 'cane'), P('Лоцман', 'quiet', 'sched'), P('Моторист', 'tools', 'strong'),
        P('Проводник мотоциклистов', 'driver'), P('Гастролирующий артист', 'whistle'),
      ],
      enabled: true,
    },
    {
      id: 'courier', title: 'Редакция «Вечерний курьер»', short: 'Редакция', icon: 'book', year: '1935', difficulty: 2,
      victim: 'Пётр Мельников, главный редактор', time: '22:45',
      teaser: 'До сдачи номера оставался час, а редактор заперся в кабинете с гранками разоблачительной статьи. Когда дверь взломали, статьи уже не было, а редактору никто не мог помочь. Типография ждала и печатала пустую полосу.',
      locations: ['Кабинет редактора', 'Наборный цех', 'Машинное отделение', 'Общая комната репортёров', 'Архив', 'Курилка', 'Приёмная'], scene: 'Кабинет редактора',
      professions: [
        P('Репортёр-расследователь', 'late', 'french'), P('Корректор', 'glasses', 'quiet'), P('Наборщик', 'tools', 'glasses'), P('Печатник', 'strong', 'tech'),
        P('Секретарь редакции', 'keys', 'safe'), P('Фельетонист', 'whistle'), P('Фотограф', 'tech', 'late'), P('Заведующий архивом', 'keys', 'quiet'),
        P('Выпускающий редактор', 'sched'), P('Издатель', 'cash', 'safe'), P('Рекламный агент', 'cash'), P('Курьер-мальчик', 'passages', 'quiet'),
        P('Театральный обозреватель', 'perfume', 'french'), P('Юрист редакции', 'safe'), P('Электрик типографии', 'tech', 'tools'), P('Ночной сторож', 'keys', 'sched'),
        P('Спортивный репортёр', 'strong'), P('Графолог-консультант', 'glasses'),
      ],
      enabled: true,
    },
    {
      id: 'hippodrome', title: 'Ипподром «Золотая подкова»', short: 'Ипподром', icon: 'casino', year: '1950', difficulty: 2,
      victim: 'Эрнест Вайс, владелец конюшни', time: '15:25',
      teaser: 'Фаворит заезда пришёл последним, хотя владелец конюшни поставил на него всё. Эрнеста Вайса нашли в денниках ещё до финального гонга. Кто-то слишком хорошо знал, что фаворит не победит, а кто-то помог ему не победить.',
      locations: ['Трибуна', 'Конюшня', 'Касса тотализатора', 'Паддок', 'Весовая', 'Ложа владельцев', 'Склад кормов'], scene: 'Конюшня',
      professions: [
        P('Жокей', 'strong', 'quiet'), P('Тренер', 'strong'), P('Конюх', 'strong', 'tools'), P('Ветеринар', 'medic'),
        P('Кассир тотализатора', 'cash', 'safe'), P('Букмекер', 'cash'), P('Секретарь ипподрома', 'keys', 'sched'), P('Судья на финише', 'glasses', 'sched'),
        P('Коновал-кузнец', 'tools', 'strong'), P('Владелец соперничающей конюшни', 'cash'), P('Репортёр скачек', 'french'), P('Завсегдатай трибун', 'smoker'),
        P('Фуражир', 'driver', 'keys'), P('Охранник', 'keys', 'strong'), P('Бухгалтер ипподрома', 'safe', 'cash'), P('Диктор', 'whistle'),
        P('Наездница-любительница', 'perfume'), P('Заводчик лошадей', 'cane'),
      ],
      enabled: true,
    },
    {
      id: 'greenhouse', title: 'Оранжерея профессора Лунда', short: 'Оранжерея', icon: 'spa', year: '1930', difficulty: 3,
      victim: 'Профессор Густав Лунд, ботаник', time: '10:30',
      teaser: 'В оранжерее профессора Лунда расцвёл цветок, который в этих краях не цветёт, и профессор обещал рассказать, откуда он взялся. Теперь Лунд лежит среди орхидей, а на листьях видна редкая пыльца. Яд принёс один человек, а привёл профессора к цветку другой.',
      locations: ['Главная оранжерея', 'Лаборатория', 'Тропический павильон', 'Кабинет профессора', 'Подсобка садовников', 'Кафе при саду', 'Аллея у входа'], scene: 'Тропический павильон',
      professions: [
        P('Садовник', 'tools', 'strong'), P('Ботаник-ассистент', 'medic', 'glasses'), P('Лаборант-химик', 'medic', 'tools'), P('Хранитель гербария', 'quiet'),
        P('Директор сада', 'keys', 'cash'), P('Кассир сада', 'cash', 'safe'), P('Электрик', 'tech'), P('Страж у входа', 'keys', 'strong'),
        P('Торговец редкими растениями', 'cash', 'french'), P('Коллекционер орхидей', 'perfume', 'cash'), P('Иллюстратор', 'lefty', 'glasses'), P('Секретарь профессора', 'safe', 'keys'),
        P('Экскурсовод', 'french', 'whistle'), P('Водитель фургона', 'driver'), P('Студент-практикант', 'late'), P('Фармацевт', 'medic'),
        P('Поставщик удобрений', 'cash', 'driver'), P('Знаток тропических трав', 'quiet', 'medic'),
      ],
      enabled: true,
    },
    {
      id: 'polar', title: 'Полярная станция «Полюс-2»', short: 'Полярная станция', icon: 'lighthouse', year: '1957', difficulty: 3,
      victim: 'Игнат Северов, начальник станции', time: '05:35',
      teaser: 'До ближайшего жилья двести километров, радио молчит третьи сутки. Начальник станции вышел на замер температуры и остался в снегу у метеобудки. К дому вели два ряда следов, а вернулся, по словам всех, только один.',
      locations: ['Метеобудка', 'Кают-компания', 'Радиорубка', 'Дизельная', 'Склад провианта', 'Лаборатория льда', 'Тамбур'], scene: 'Метеобудка',
      professions: [
        P('Метеоролог', 'tech', 'sched'), P('Радист', 'tech', 'late'), P('Дизелист', 'tools', 'strong'), P('Повар', 'tools'),
        P('Врач станции', 'medic'), P('Гляциолог', 'tech', 'glasses'), P('Механик вездехода', 'driver', 'tools'), P('Каюр', 'strong', 'quiet'),
        P('Завхоз', 'keys', 'cash'), P('Геофизик', 'tech'), P('Помощник начальника', 'keys', 'safe'), P('Корреспондент', 'french'),
        P('Охотник-проводник', 'strong', 'quiet'), P('Аэролог', 'sched'), P('Лаборантка', 'tools', 'glasses'), P('Радиотехник', 'tech', 'tools'),
        P('Ночной дежурный', 'late', 'keys'), P('Инспектор из центра', 'safe', 'sched'),
      ],
      enabled: true,
    },
    {
      id: 'modern', title: 'Кинотеатр «Модерн»', short: 'Кинотеатр', icon: 'film', year: '1956', difficulty: 1,
      victim: 'Рудольф Баум, киномеханик', time: '23:55',
      teaser: 'Ночной сеанс закончился, зал опустел, а в будке киномеханика остались включённый проектор и распахнутая дверь. Рудольф Баум лежит между бобинами. В кассе нашлись два билета, купленные на разные ряды в один и тот же час.',
      locations: ['Зрительный зал', 'Будка киномеханика', 'Фойе', 'Касса', 'Буфет', 'Подвал с бобинами', 'Служебный выход'], scene: 'Будка киномеханика',
      professions: [
        P('Киномеханик-помощник', 'tech', 'tools'), P('Кассир', 'cash', 'safe'), P('Билетёр', 'passages', 'sched'), P('Директор кинотеатра', 'keys', 'safe'),
        P('Буфетчица', 'cash', 'candy'), P('Уборщик', 'passages', 'quiet'), P('Афишист', 'lefty'), P('Электрик', 'tech'),
        P('Киножурналист', 'french', 'glasses'), P('Хранитель плёнок', 'keys', 'quiet'), P('Прокатчик', 'cash', 'driver'), P('Музыкант-тапёр', 'whistle', 'quiet'),
        P('Ночной сторож', 'keys', 'sched'), P('Зритель-завсегдатай', 'smoker'), P('Контролёр', 'strong'), P('Инспектор пожарной охраны', 'keys', 'tools'),
        P('Монтажёр', 'tools', 'glasses'), P('Водитель кинопередвижки', 'driver'),
      ],
      enabled: true,
    },
    {
      id: 'caravan', title: 'Караван-сарай «Три колодца»', short: 'Караван-сарай', icon: 'pyramid', year: '1924', difficulty: 2,
      victim: 'Хаким Бахрам, торговец шёлком', time: '01:10',
      teaser: 'Верблюды не тронуты, товар цел, а торговец Бахрам лежит у колодца с обрывком чужой чалмы в руке. Ворота на ночь заперты изнутри, и караван стоит на месте. Стража видела тень, а потом ещё одну.',
      locations: ['Внутренний двор', 'Колодец', 'Чайхана', 'Конюшня', 'Склад товаров', 'Комната торговца', 'Сторожевая башня'], scene: 'Колодец',
      professions: [
        P('Караванщик', 'strong', 'passages'), P('Хозяин караван-сарая', 'keys', 'cash'), P('Страж ворот', 'keys', 'strong'), P('Чайханщик', 'tools'),
        P('Переводчик', 'french', 'quiet'), P('Знахарь', 'medic'), P('Менялы', 'cash', 'safe'), P('Погонщик верблюдов', 'strong'),
        P('Кузнец', 'tools', 'strong'), P('Торговец пряностями', 'cash', 'perfume'), P('Паломник', 'cane', 'quiet'), P('Проводник по пескам', 'passages', 'quiet'),
        P('Писарь', 'glasses', 'safe'), P('Оружейник', 'tools', 'strong'), P('Купец-соперник', 'cash'), P('Музыкант-дудочник', 'whistle'),
        P('Конюх', 'strong', 'tools'), P('Хранитель весов', 'safe', 'cash'),
      ],
      enabled: true,
    },
    {
      id: 'northstation', title: 'Вокзал «Северный»', short: 'Вокзал', icon: 'train', year: '1944', difficulty: 2,
      victim: 'Макар Дроздов, начальник вокзала', time: '06:20',
      teaser: 'Первый рейс задержали, потому что начальник вокзала не вышел встречать состав. Дроздова нашли за закрытой кассой, а из кассы пропали деньги на два билета до границы. Из города за ночь никто не уехал, значит, взявшие деньги ещё на вокзале.',
      locations: ['Билетный зал', 'Касса', 'Перрон', 'Камера хранения', 'Багажный вагон', 'Диспетчерская', 'Привокзальный буфет'], scene: 'Касса',
      professions: [
        P('Кассир', 'cash', 'safe'), P('Дежурный по станции', 'sched', 'keys'), P('Носильщик', 'strong'), P('Заведующий камерой хранения', 'keys', 'quiet'),
        P('Диспетчер', 'sched', 'tech'), P('Стрелочник', 'tools', 'strong'), P('Милиционер', 'strong', 'keys'), P('Буфетчица', 'cash'),
        P('Машинист', 'tech', 'strong'), P('Проводница', 'keys', 'perfume'), P('Пассажир с чемоданом', 'cane'), P('Контролёр', 'passages', 'sched'),
        P('Железнодорожный врач', 'medic'), P('Телеграфист', 'tech', 'late'), P('Уборщик', 'passages', 'quiet'), P('Таксист у вокзала', 'driver'),
        P('Фельдъегерь', 'french', 'safe'), P('Агент по продаже билетов', 'cash', 'glasses'),
      ],
      enabled: true,
    },
    {
      id: 'lily', title: 'Аптека «Белая лилия»', short: 'Аптека', icon: 'clinic', year: '1941', difficulty: 3,
      victim: 'Матильда Арно, провизор', time: '20:10',
      teaser: 'Аптека закрылась в восемь, а свет в подсобке горел дольше обычного. Провизор Арно знала состав каждого порошка и не ошиблась бы в дозе, но в чашке оказалось то, чего она никогда не пила. Яд подмешали в закрытом помещении, а значит, кто-то остался после закрытия.',
      locations: ['Торговый зал', 'Подсобка провизора', 'Склад лекарств', 'Лаборатория', 'Приёмная', 'Задний двор', 'Кабинет владельца'], scene: 'Подсобка провизора',
      professions: [
        P('Помощник провизора', 'medic', 'tools'), P('Кассир', 'cash', 'safe'), P('Врач, выписывающий рецепты', 'medic', 'glasses'), P('Курьер', 'driver', 'passages'),
        P('Владелец аптеки', 'safe', 'keys'), P('Лаборант', 'medic', 'tools'), P('Сторож', 'keys', 'sched'), P('Уборщик', 'passages', 'quiet'),
        P('Поставщик трав', 'cash', 'driver'), P('Санитарный инспектор', 'sched', 'keys'), P('Постоянный клиент', 'cane', 'smoker'), P('Знахарка-соперница', 'medic', 'perfume'),
        P('Бухгалтер', 'safe', 'cash'), P('Упаковщик', 'tools'), P('Представитель фармфабрики', 'french', 'cash'), P('Практикант', 'late', 'quiet'),
        P('Стекольщик', 'tools'), P('Сосед-часовщик', 'tools', 'glasses'),
      ],
      enabled: true,
    },
  ];

  /* Паки: набор дел, из которого комната выбирает случайное. Пока пак один. */
  const PACKS = [
    { id: 'main', title: 'Основной', desc: 'Убийца и сообщник, разные места и эпохи.' },
  ];
  CASES.forEach((c) => { c.pack = 'main'; });
  const PRO_SKILLS = ['quiet', 'strong', 'tools', 'french'];
  /* Своё наполнение каждого дела: приметы для особенностей и улик, формулировки улик для профессий, связи, мотивы, тайны. */
  CASES.forEach((c) => {
    const d = Extra && Extra[c.id];
    if (!d) return;
    // Приметы теперь у каждого дела свои, поэтому профессии несут только умения и доступы, а не общие приметы вроде «курит» или «в очках».
    c.professions.forEach((p) => { p.tags = p.tags.filter((t) => !Content.TAGS[t].habit || PRO_SKILLS.includes(t)); });
    c.habits = d.habits.map((h) => ({ key: `${c.id}.${h.key}`, label: h.label, habit: h.habit, clues: h.clues.slice() }));
    c.proClues = JSON.parse(JSON.stringify(d.proClues || {}));
    c.relations = d.relations.slice(); c.motives = d.motives.slice(); c.secrets = d.secrets.slice();
    Content.registerCase(c);
  });
  const DETAIL_KEYS = ['habits', 'proClues', 'relations', 'motives', 'secrets'];
  /** Дела первых версий вышли из архива вместе с переходом на двух преступников. */
  const RETIRED_IDS = ['mansion', 'train', 'corporate', 'yacht', 'museum', 'lighthouse', 'ski', 'casino', 'studio', 'clinic', 'library',
    'circus', 'airship', 'dig', 'radio', 'winery', 'bank', 'sanatorium', 'riverboat', 'chess'];
  const PACK_REV = 1;

  const ICONS = ['mansion', 'train', 'corporate', 'yacht', 'theatre', 'hotel', 'generic',
    'museum', 'lighthouse', 'mountain', 'casino', 'film', 'clinic', 'book', 'circus', 'airship', 'pyramid', 'radio', 'wine', 'bank', 'spa', 'steamboat', 'chess'];

  function byId(id, list = CASES) {
    return list.find((c) => c.id === id) || null;
  }

  /** "Название | тег, тег" по строке на профессию. */
  function parseProfessions(text) {
    return String(text || '').split('\n').map((line) => {
      const [name, tags] = line.split('|');
      const nm = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 40);
      if (!nm) return null;
      const list = String(tags || '').split(/[,\s]+/).map((t) => t.trim().toLowerCase()).filter((t) => Object.prototype.hasOwnProperty.call(Content.TAGS, t));
      return { name: nm, tags: Array.from(new Set(list)).slice(0, 3) };
    }).filter(Boolean).slice(0, 20);
  }
  function professionsToText(list) {
    return (list || []).map((p) => `${p.name} | ${p.tags.join(', ')}`).join('\n');
  }

  /** Проверка и нормализация дела из админки. Бросает Error с понятным текстом. */
  function validateCase(input, existingIds = []) {
    const str = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
    const locations = (Array.isArray(input.locations) ? input.locations : String(input.locations || '').split(/\n|,/))
      .map((l) => str(l, 40)).filter(Boolean).slice(0, 12);
    const professions = Array.isArray(input.professions)
      ? input.professions.filter((x) => x && typeof x === 'object').map((x) => ({ name: str(x.name, 40), tags: Array.from(new Set((Array.isArray(x.tags) ? x.tags : []).map(String).filter((t) => Object.prototype.hasOwnProperty.call(Content.TAGS, t)))).slice(0, 3) })).filter((x) => x.name).slice(0, 20)
      : parseProfessions(input.professions);
    const c = {
      id: str(input.id, 40).toLowerCase().replace(/[^a-z0-9-]/g, ''),
      title: str(input.title, 80),
      short: str(input.short, 24),
      icon: ICONS.includes(input.icon) ? input.icon : 'generic',
      year: str(input.year, 12),
      difficulty: Math.min(3, Math.max(1, Math.round(Number(input.difficulty) || 2))),
      victim: str(input.victim, 120),
      time: str(input.time, 5),
      teaser: str(input.teaser, 400),
      locations,
      scene: str(input.scene, 40),
      professions,
      pack: PACKS.some((p) => p.id === input.pack) ? input.pack : 'main',
      enabled: input.enabled !== false,
    };
    // Наполнение дела переносится как есть, если пришло целиком (импорт или копия встроенного дела).
    const strs = (v, max, cap) => (Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, cap) : undefined);
    if (Array.isArray(input.habits)) {
      c.habits = input.habits.filter((h) => h && typeof h === 'object' && h.key && h.label).slice(0, 40)
        .map((h) => ({ key: str(h.key, 60).replace(/[^a-z0-9.-]/gi, ''), label: str(h.label, 40), habit: str(h.habit || h.label, 60), clues: strs(h.clues, 300, 4) || [] }))
        .filter((h) => h.key && !Object.prototype.hasOwnProperty.call(Content.TAGS, h.key) || (Content.TAGS[h.key] && Content.TAGS[h.key].own));
    }
    if (input.proClues && typeof input.proClues === 'object') {
      c.proClues = {};
      Object.keys(input.proClues).filter((k) => Object.prototype.hasOwnProperty.call(Content.TAGS, k)).forEach((k) => { const v = strs(input.proClues[k], 300, 4); if (v && v.length) c.proClues[k] = v; });
    }
    ['relations', 'motives', 'secrets'].forEach((k) => { const v = strs(input[k], 120, 40); if (v) c[k] = v; });
    if (!c.title) throw new Error('У дела должно быть название.');
    if (!c.victim) throw new Error('Укажите жертву.');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(c.time)) throw new Error('Время смерти пишется как ЧЧ:ММ, например 23:40.');
    if (c.teaser.length < 20) throw new Error('Вводная слишком короткая: напишите хотя бы пару предложений.');
    if (c.locations.length < 4) throw new Error('Нужно хотя бы четыре места: одно место преступления и три для алиби.');
    if (!c.scene || !c.locations.includes(c.scene)) c.scene = c.locations[0];
    if (c.professions.length < 4) throw new Error('Нужно хотя бы четыре профессии. Формат строки: «Бухгалтер | safe, cash».');
    if (!c.short) c.short = c.title.replace(/[«»"]/g, '').split(' ')[0];
    if (!c.id) {
      let base = 'case-' + Date.now().toString(36);
      while (existingIds.includes(base)) base += 'x';
      c.id = base;
    }
    return c;
  }

  /** Версия текстов встроенных дел: при её росте тексты уже сохранённых встроенных дел обновляются один раз. */
  const TEXT_REV = 4;

  /** Новые встроенные дела добавляются в уже сохранённый архив один раз; удалённые админом не возвращаются.
      При смене ревизии паков дела первых версий убираются из сохранённого архива, а у остальных проставляется пак. */
  function mergeBuiltins(list, seen, textRev, packRev) {
    const known = new Set(seen || []);
    const have = new Set(list.map((c) => c.id));
    let added = 0, refreshed = 0, retired = 0;
    if ((packRev || 0) < PACK_REV) {
      for (let i = list.length - 1; i >= 0; i--) if (RETIRED_IDS.includes(list[i].id)) { list.splice(i, 1); retired++; }
      RETIRED_IDS.forEach((id) => known.add(id));
    }
    list.forEach((c) => { if (!c.pack) c.pack = 'main'; });
    CASES.forEach((c) => {
      if (!known.has(c.id) && !have.has(c.id)) { list.push(JSON.parse(JSON.stringify(c))); added++; }
      else if ((textRev || 0) < TEXT_REV) {
        const saved = list.find((x) => x.id === c.id);
        if (saved) {
          ['title', 'victim', 'teaser'].forEach((k) => { saved[k] = c[k]; });
          saved.professions = JSON.parse(JSON.stringify(c.professions));
          DETAIL_KEYS.forEach((k) => { if (c[k] !== undefined) saved[k] = JSON.parse(JSON.stringify(c[k])); });
          refreshed++;
        }
      }
      known.add(c.id);
    });
    return { added, refreshed, retired, seen: Array.from(known), textRev: TEXT_REV, packRev: PACK_REV };
  }

  const LEGACY_IDS = ['mansion', 'train', 'corporate', 'yacht'];

  return { CASES, PACKS, RETIRED_IDS, PACK_REV, ICONS, LEGACY_IDS, TEXT_REV, byId, mergeBuiltins, validateCase, parseProfessions, professionsToText };
});
