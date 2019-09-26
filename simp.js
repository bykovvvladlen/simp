window.simp = (function() {
  let _selector, _callback, _current, _listeners, _tree;

  function init() {
    // Добавить новый узел в дерево
    function insert(node) {
      _current = _tree.length;

      function copy_node(settings, { html, data, create }) {
        let copy = {
          html: typeof html == 'object' ? Object.assign({}, html) : html,
          data: Object.assign({}, data),
          create: create
        }

        return Object.assign(copy, settings);
      }

      let settings = { template: node }
      let node_prepared = copy_node(settings, node);

      let html;
      if (typeof node.html == 'object') {
        html = node.html.outerHTML;
      }
      else if (!node.html.match(/<|>/g)) {
        html = document.querySelector(node.html).outerHTML;
      }
      else html = node.html;

      node_prepared.html = html;
      node_prepared.position = () => _tree.indexOf(node_prepared);
      node_prepared.set = settings => {
        if (!node_prepared.visible) Object.assign(node_prepared.data, settings);
        else {
          let elem = current().dom_element;
          Object.keys(settings).forEach(key => {
            let val = settings[key];
            current().data[key] = val;

            let editable = elem.querySelector(`div[contenteditable='true'][data-simp='${key}']`);
            if (editable) editable.innerText = val;
            else elem.querySelector(`input[data-simp='${key}']`).value = val;
          });
        }
      }

      _tree.push(node_prepared);
    }

    // Закрыть узел
    function hide() {
      _tree.filter(e => e.position() != _current && e.visible).forEach(e => {
        let html = e.dom_element.outerHTML;
        e.dom_element.remove();
        e.visible = false;
        e.html = html;
      });
    }

    // Перебиндить инпуты в узле
    function rebind() {
      function addEventListener(obj, name, listener) {
        obj.addEventListener(name, listener);
        if (!_listeners[obj]) _listeners[obj] = {};
        _listeners[obj][name] = listener;
      }

      function removeEventListeners(obj) {
        if (_listeners[obj]) Object.keys(_listeners[obj]).forEach(name => {
          obj.removeEventListener(name, _listeners[obj][name]);
        })
        _listeners = {}
      }

      let node = current();
      let inputs = node.dom_element.querySelectorAll(`input, div[contenteditable='true']`);
      inputs.forEach((input, index) => {
        let datasimp = input.getAttribute('data-simp');
        let isDiv = input.tagName == "DIV";

        if (!datasimp) {
          datasimp = `input${index}`;
          input.setAttribute('data-simp', datasimp);
          node.data[datasimp] = isDiv ? input.innerHTML : input.value;
        }

        else if (Object.keys(node.data).includes(datasimp)) {
          if (isDiv) input.innerHTML = node.data[datasimp];
          else input.value = node.data[datasimp];
        }

        else node.data[datasimp] = isDiv ? input.innerHTML : input.value;

        removeEventListeners(input);
        addEventListener(input, 'keyup', () => {
          node.data[datasimp] = isDiv ? input.innerHTML : input.value;
        });

        let input_update = ({ currentTarget: target }) => {
          setTimeout(() => {
            node.data[datasimp] = target.value;
          }, 50);
        }

        addEventListener(input, 'cut', input_update);
        addEventListener(input, 'paste', input_update);
      });
    }

    // Отобразить узел
    function show(extra) {
      hide();

      function createElement(str) {
        let div = document.createElement('div');
        div.innerHTML = str;
        return div.firstChild;
      }

      let node = current();
      let dom_element = _selector.appendChild(createElement(node.html));
      node.visible = true;
      node.dom_element = dom_element;

      Object.assign(node.data, Object.assign({}, extra));
      rebind();

      let helper = {
        click: (selector, fn) => {
          node.dom_element.querySelector(selector).onclick = fn;
        },
        find: selector => {
          let element = node.dom_element.querySelector(selector);
          return window.jQuery ? window.jQuery(element) : element;
        }
      }

      node.create.call(node.data, helper);
      if (_callback) _callback();
    }

    // Открыть узел
    function open(node, extra) {
      insert(node);
      show(extra);
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

    // Вернуться на предыдущий узел
    function back(step = 1) {
      if (_current != 0) {
        if (_current - step < 0) step = _current;
        while (step > 0) {
          _current -= 1;
          hide();

          _tree.pop();
          step--;
        }

        show();
      }
    }

    // Возвращает объект данных со всех узлов
    function fetch() {
      return _tree.reduce((acc, elem, index) => {
        Object.keys(elem.data).forEach(key => {
          acc[key] = elem.data[key];
        });

        return acc;
      }, {});
    }

    // Возвращает объект данных узла (текущего или смещенного)
    function data(step = 0) {
      return _tree[_current - Math.min(_current, Math.abs(step))].data;
    }

    // Применить новые данные для текущего узла
    function set(settings) {
      current().set(settings);
    }

    return {
      set: set,
      open: open,
      curr: current,
      prev: previous,
      back: back,
      tree: _tree,
      data: data,
      fetch: fetch,
      rebind: rebind
    }
  }

  return (selector, callback) => {
    _selector = document.querySelector(selector || 'body');
    _callback = callback;
    _listeners = {};
    _tree = [];

    document.querySelector('.forsimp').style.display = "none";
    return init();
  }
})();