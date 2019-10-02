(function() {
  // Список всех доступных компонентов
  let componentsList = [];
  
  // При вызове simp() отдаем новый вью
  var simp = function(selector, renderCallback) {
    if (!(this instanceof simp)) {
      return new simp(selector, renderCallback);
    }
    
    // Ищем по селектору элемент и присваиваем его вместо первого
    let _selector = document.querySelector(selector || 'body'),
      // Колбэк, вызываемый при рендере узла
      _renderCallback = renderCallback,
      // Список эвент листенеров
      _listenersList = {},
      // Дерево узлов
      _tree = [],
      // Индекс текущего узла
      _current,
      // Текущий вью
      _view;
    
    // Добавить эвент листенер
    function addEventListener(obj, name, listener) {
      obj.addEventListener(name, listener);
      if (!_listenersList[obj]) _listenersList[obj] = {};
      _listenersList[obj][name] = listener;
    }

    // Удалить все эвент листенеры объекта
    function removeEventListeners(obj) {
      if (_listenersList[obj]) Object.keys(_listenersList[obj]).forEach(name => {
        obj.removeEventListener(name, _listenersList[obj][name]);
      });
      _listenersList = {};
    }
    
    // Создает элемент из строки
    function createElement(str) {
      let div = document.createElement('div');
      div.innerHTML = str;
      return div.firstChild;
    }
    
    // Подготовить хранилище узла к работе
    function prepareStorageFor(node) {
      // Само хранилище в замыкании
      let copy = Object.assign({}, node.storage);
      
      // Список колбэков (general для инпутов, customs для подписки)
      let list = { general: [], customs: [] };
      
      // Добавить колбэк в список
      function add(callback, group = 'general') {
        list[group].push(callback);
      }
      
      // Очистить список колбэков
      function clear(group = 'general') {
        list[group] = [];
      }
      
      // Вызвать колбэки
      function fire(changes, group = 'general') {
        list[group].forEach(callback => callback(changes));
      } 
      
      // Объект для работы с колбэками
      let callbacks = {
        list: list,
        add: add,
        clear: clear,
        fire: fire
      }
      
      // При обращении к storage() возвращаем объект хранилища
      let prepared = function() {
        return copy;
      }

      // Методы для работы с хранилищем
      prepared.__proto__ = {
        set: (settings) => {
          Object.assign(copy, settings);
          callbacks.fire(settings);
          callbacks.fire(settings, 'customs');
        },
        callbacks: callbacks,
      }
      
      // Присваиваем узлу подготовленную копию хранилища
      node.storage = prepared;
    }
    
    // Добавить новый узел в дерево
    function insert(component) {
      _current = _tree.length;
      
      // Прототип узла
      let node_proto = {
        position: function() {
          return _tree.indexOf(this);
        }
      }
      
      // Создаем из компонента новый экземпляр узла
      let node = Object.assign({}, component);
      
      // Инициализируем методы для работы с хранилищем
      prepareStorageFor(node);
      
      // Готовый узел добавляем в дерево
      _tree.push(node);
    }
    
    // Скрыть все неиспользуемые узлы
    function hideNodes() {
      _tree.filter(e => e != current() && e.visible).forEach(e => {
        // Сохраняем состояние разметки до востребования
        e.markup = e.DOMElement.outerHTML;
        // Соответствующий блок удаляем
        e.DOMElement.remove();
        e.visible = false;
      });
    }
    
    // Текущий узел
    function current() {
      return _tree[_current];
    }
    
    // Предыдущий узел
    function previous(step = 1) {
      let index = Math.max(0, _current - Math.max(Math.abs(step), 1));
      return _tree[index];
    }
    
    // Перебиндить инпуты в узле
    function rebind() {
      let node = current();
      // Находим все дивы и инпуты, с которых будем собирать данные
      let inputs = node.DOMElement.querySelectorAll(`input, div[contenteditable='true']`);
      
      // Удаляем предыдущие колбэки, если они есть
      node.storage.callbacks.clear();
      
      // Проходимся по каждому элементу
      inputs.forEach((input, index) => {
        // simp-id является ключом инпута в хранилище
        let id = input.getAttribute('data-simp-id');
        // Является ли элемент дивом
        let isDiv = input.tagName == "DIV";

        // Если у элемента не задан id
        if (!id) {
          // Генерируем свой
          id = `input${index}`;
          input.setAttribute('data-simp-id', id);
          // Записываем в хранилище содержимое элемента, если оно есть
          node.storage()[id] = isDiv ? input.innerHTML : input.value;
        }

        // Если id задан и ключ находится в хранилище
        else if (Object.keys(node.storage()).includes(id)) {
          // Присваиваем элементу значение из хранилища
          if (isDiv) input.innerHTML = node.storage()[id];
          else input.value = node.storage()[id];
        }

        // Если id задан, но в хранилище ключа нет, присваиваем значение элемента
        else node.storage()[id] = isDiv ? input.innerHTML : input.value;

        // Удаляем старые эвент листенеры и добавляем новые
        removeEventListeners(input);
        // При нажатии на клавишу
        addEventListener(input, 'keyup', () => {
          let value = isDiv ? input.innerHTML : input.value;
          // Занести новое значение в хранилище
          node.storage()[id] = value;
          
          let changes = {};
          changes[id] = value;
          // Вызовем колбэк хранилища с изминениями
          node.storage.callbacks.fire(changes, 'customs');
        });

        // При копипасте через 50мс записываем новое значение
        let input_update = ({ currentTarget: target }) => {
          setTimeout(() => {
            node.storage()[id] = target.value;
          }, 50);
        }

        addEventListener(input, 'cut', input_update);
        addEventListener(input, 'paste', input_update);
        
        // Добавляем колбэк, меняющий содержимое элемента при изменении поля в хранилище
        node.storage.callbacks.add(changes => {
          // Если id поля есть в изменениях
          if (id in changes) {
            if (isDiv) input.innerHTML = changes[id];
            else input.value = changes[id];
          }
        });
      });
    }
    
    // Отрисовать текущий узел
    function render(extra) {
      // Спрячем все старые узлы
      hideNodes();

      let node = current();
      // Создаем элемент
      let DOMElement = _selector.appendChild(createElement(node.markup));
      
      node.visible = true;
      node.DOMElement = DOMElement;

      // Добавляем в хранилище extra
      Object.assign(node.storage(), extra);
      // Биндим инпуты
      rebind();
      
      // Вызываем колбэк компонента (узла)
      node.creationCallback.call(_view);
      // Если есть, вызываем колбэк при рендере
      if (_renderCallback) _renderCallback(node);
    }
               
    // Открыть узел
    function open(component, extra) {
      // Помещаем компонент в дерево
      insert(component);
      // Рисуем и биндим
      render(extra);
    }
                                        
    // Вернуться на предыдущий узел
    function back(step = 1) {
      if (_current != 0) {
        if (_current - step < 0) step = _current;
        while (step > 0) {
          _current -= 1;
          hideNodes();

          _tree.pop();
          step--;
        }

        render();
      }
    }
                                                 
    // Возвращает объект данных со всех узлов
    function fetch() {
      return _tree.reduce((acc, elem, index) => {
        Object.keys(elem.storage()).forEach(key => {
          acc[key] = elem.storage()[key];
        });

        return acc;
      }, {});
    }
                                                 
    // Возвращает объект данных узла (текущего или смещенного)
    function storage(step = 0) {
      return _tree[_current - Math.min(_current, Math.abs(step))].storage();
    }
                   
    // Поместить новые значения в хранилище
    function set(settings) {
      current().storage.set(settings);
    }

    // Подписаться на клик элемента внутри узла
    function click(selector, fn) {
      current().DOMElement.querySelector(selector).onclick = fn;
    }
    
    // Найти элемент внутри узла
    function find(selector) {
      return current().DOMElement.querySelector(selector);
    }
    
    // Найти элементы внутри узла
    function findAll(selector) {
      return current().DOMElement.querySelectorAll(selector);
    }
    
    // Подписаться на изменения в хранилище
    function subscribe(callback, fieldname) {
      // Добавим пользовательский колбэк
      current().storage.callbacks.add(changes => {
        // Если подписались на определенное значение, смотрим, есть ли оно
        if (fieldname && fieldname in changes) {
          // Если есть, отправляем сразу его
          callback(changes[fieldname]);
        } 
        
        // Если нет, отправляем изменения
        else callback(changes);
      }, 'customs');
    }
    
    // Финальный объект вью со всеми функциями
    _view = {
      open: open,
      find: find,
      findAll: findAll,
      click: click,
      storage: storage,
      set: set,
      fetch: fetch,
      current: current,
      prev: previous,
      back: back,
      rebind: rebind,
      subscribe: subscribe,
      tree: () => _tree
    }

    // Возвращем новый вью
    return _view;
  }
  
  // Создать компонент
  function createComponent(selector, creationCallback, storage = {}) {
    let component = {
      selector: selector,
      // Создаем новый экземпляр хранилища
      storage: Object.assign({}, storage),
      creationCallback: creationCallback,
      // Выбираем по селектору блок с разметкой
      markup: document.querySelector(selector).outerHTML
    }
    
    // Скрываем родительский элемент
    document.querySelector(selector).style.display = "none";
    
    // Добавим в общий список компонентов
    componentsList.push(component);
    return component;
  }
  
  simp.__proto__ = {
    component: createComponent,
    componentsList: () => componentsList
  }
  
  window.simp = simp;
})();