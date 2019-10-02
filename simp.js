(function() {
  // Список всех доступных компонентов
  let componentsList = [];
  
  var simp = function(selector, renderCallback) {
    if (!(this instanceof simp)) {
      return new simp(selector, renderCallback);
    }
    
    let _selector = document.querySelector(selector || 'body'),
      _renderCallback = renderCallback,
      _listenersList = {},
      _tree = [],
      _current,
      _view;
    
    function addEventListener(obj, name, listener) {
      obj.addEventListener(name, listener);
      if (!_listenersList[obj]) _listenersList[obj] = {};
      _listenersList[obj][name] = listener;
    }

    function removeEventListeners(obj) {
      if (_listenersList[obj]) Object.keys(_listenersList[obj]).forEach(name => {
        obj.removeEventListener(name, _listenersList[obj][name]);
      });
      _listenersList = {};
    }
    
    function createElement(str) {
      let div = document.createElement('div');
      div.innerHTML = str;
      return div.firstChild;
    }
    
    // Подготовить хранилище узла к работе
    function prepareStorageFor(node) {
      let copy = Object.assign({}, node.storage);
      let callbacks = {
        list: {
          incoming: [],
          outcoming: []
        },
        add: function(fn, group = 'incoming') {
          this.list[group].push(fn)
        },
        clear: function(group = 'incoming') {
          this.list[group] = [];
        },
        fire: function(changes, group = 'incoming') {
          this.list[group].forEach(fn => fn(changes));
        } 
      }

      let prepared = function() {
        return copy;
      }

      prepared.__proto__ = {
        set: (settings) => {
          Object.assign(copy, settings);
          callbacks.fire(settings);
        },
        callbacks: callbacks,
      }
      
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
      let inputs = node.DOMElement.querySelectorAll(`input, div[contenteditable='true']`);
      
      node.storage.callbacks.clear();
      
      inputs.forEach((input, index) => {
        let id = input.getAttribute('data-simp-id');
        let isDiv = input.tagName == "DIV";

        if (!id) {
          id = `input${index}`;
          input.setAttribute('data-simp-id', id);
          node.storage()[id] = isDiv ? input.innerHTML : input.value;
        }

        else if (Object.keys(node.storage()).includes(id)) {
          if (isDiv) input.innerHTML = node.storage()[id];
          else input.value = node.storage()[id];
        }

        else node.storage()[id] = isDiv ? input.innerHTML : input.value;

        removeEventListeners(input);
        addEventListener(input, 'keyup', () => {
          let value = isDiv ? input.innerHTML : input.value;
          node.storage()[id] = value;
          
          let changes = {};
          changes[id] = value;
          node.storage.callbacks.fire(changes, 'outcoming');
        });

        let input_update = ({ currentTarget: target }) => {
          setTimeout(() => {
            node.storage()[id] = target.value;
          }, 50);
        }

        addEventListener(input, 'cut', input_update);
        addEventListener(input, 'paste', input_update);
        
        node.storage.callbacks.add(changes => {
          if (id in changes) {
            if (isDiv) input.innerHTML = changes[id];
            else input.value = changes[id];
          }
        });
      });
    }
    
    // Отрисовать текущий узел
    function render(extra) {
      hideNodes();

      let node = current();
      let DOMElement = _selector.appendChild(createElement(node.markup));
      
      node.visible = true;
      node.DOMElement = DOMElement;

      Object.assign(node.storage(), extra);
      rebind();
      
      node.creationCallback.call(_view);
      if (_renderCallback) _renderCallback();
    }
               
    // Открыть узел
    function open(node, extra) {
      insert(node);
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
      let element = current().DOMElement.querySelector(selector);
      return window.jQuery ? window.jQuery(element) : element;
    }
    
    // Подписаться на изменения в хранилище
    function subscribe(callback, fieldname) {
      current().storage.callbacks.add(changes => { 
        if (fieldname && fieldname in changes) {
          callback(changes[fieldname]);
        } 
        
        else callback(changes);
      }, 'outcoming');
    }
    
    _view = {
      open: open,
      find: find,
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