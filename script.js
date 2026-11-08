const productHolder = document.getElementById('image-products');
const filterButtons = document.querySelectorAll('.filter-btn');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const cartButton = document.getElementById('cart-btn');
const cartCount = document.getElementById('cart-count');
const cartModal = document.getElementById('cart-modal');
const closeModalButton = document.getElementById('close-modal');
const cartList = document.getElementById('cart-list');
const cartTotal = document.getElementById('cart-total');
const checkoutButton = document.getElementById('checkout-btn');
const toastContainer = document.getElementById('toast-container');
const customerSelect = document.getElementById('customer-select');
const customerAddress = document.getElementById('customer-address');

const currencyFormatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'USD'
});
const brandLogos = {
    Arasaka: 'Imagenes/logo.webp',
    Militech: 'Imagenes/militech.webp',
    'Kang Tao': 'Imagenes/Kang_Tao.webp'
};
const stockStorageKey = 'the-merchant-armoury-stock-v2';
const legacyStockStorageKeys = [
    'el-buhonero-armoury-stock-v2',
    'arsen-armoury-stock-v2'
];
let allProducts = [];
let selectedCategory = 'Todo';
const cart = new Map();

fetch('data.json')
    .then(response => {
        if (!response.ok) {
            throw new Error(`No se pudo cargar data.json (${response.status})`);
        }
        return response.json();
    })
    .then(customers => {
        if (!Array.isArray(customers) || customers.some(customer =>
            typeof customer.name !== 'string' || typeof customer.address !== 'string'
        )) {
            throw new Error('La lista de clientes no tiene un formato válido.');
        }
        customerSelect.replaceChildren();
        customers.forEach(customer => {
            const option = document.createElement('option');
            option.value = customer.name;
            option.textContent = customer.name;
            option.dataset.address = customer.address;
            customerSelect.appendChild(option);
        });
        updateCustomerAddress();
    })
    .catch(error => {
        console.error('Error al cargar los clientes:', error);
        customerSelect.replaceChildren(new Option('No se pudieron cargar los clientes', ''));
        customerSelect.disabled = true;
        customerAddress.textContent = 'Comprueba que data.json esté disponible.';
    });

function updateCustomerAddress() {
    const selectedOption = customerSelect.selectedOptions[0];
    customerAddress.textContent = selectedOption ? selectedOption.dataset.address : '';
}

customerSelect.addEventListener('change', updateCustomerAddress);

fetch('productos.json')
    .then(response => {
        if (!response.ok) {
            throw new Error(`No se pudo cargar productos.json (${response.status})`);
        }
        return response.json();
    })
    .then(products => {
        if (!Array.isArray(products)) {
            throw new Error('El catálogo de productos no tiene un formato válido.');
        }
        allProducts = products;
        loadSavedStock();
        renderProducts();
    })
    .catch(error => {
        console.error('Error al cargar el catálogo:', error);
        productHolder.textContent = 'No se pudieron cargar los productos. Comprueba que productos.json esté disponible.';
        productHolder.classList.add('empty');
    });

function loadSavedStock() {
    let savedStock;
    let isMigratingStock = false;
    try {
        let storedValue = localStorage.getItem(stockStorageKey);
        for (const legacyKey of legacyStockStorageKeys) {
            if (storedValue !== null) break;
            storedValue = localStorage.getItem(legacyKey);
            isMigratingStock = storedValue !== null;
        }
        if (storedValue === null) return;
        savedStock = JSON.parse(storedValue);
    } catch (error) {
        console.error('No se pudo recuperar el stock guardado:', error);
        showToast('No se pudo recuperar el stock guardado en este navegador.');
        return;
    }

    if (!savedStock || typeof savedStock !== 'object' || Array.isArray(savedStock)) {
        console.error('El stock guardado tiene un formato no válido.');
        showToast('El stock guardado no es válido; se mostrarán las cantidades iniciales.');
        return;
    }

    if (isMigratingStock) {
        try {
            localStorage.setItem(stockStorageKey, JSON.stringify(savedStock));
        } catch (error) {
            console.error('No se pudo migrar el stock guardado al nuevo nombre:', error);
            showToast('El stock se cargó, pero no se pudo migrar al nuevo nombre.');
        }
    }

    allProducts.forEach(product => {
        const stock = savedStock[product.id];
        if (Number.isInteger(stock) && stock >= 0) {
            product.stock = stock;
        }
    });
}

function saveStock(stockById) {
    try {
        localStorage.setItem(stockStorageKey, JSON.stringify(stockById));
        return true;
    } catch (error) {
        console.error('No se pudo guardar el stock actualizado:', error);
        showToast('No se pudo guardar el stock. La compra no se ha finalizado.');
        return false;
    }
}

function renderProducts() {
    const query = searchInput.value.trim().toLocaleLowerCase();
    let products = allProducts.filter(product => {
        const matchesCategory = selectedCategory === 'Todo' || product.category === selectedCategory;
        const matchesQuery = `${product.name} ${product.description}`.toLocaleLowerCase().includes(query);
        return matchesCategory && matchesQuery;
    });

    switch (sortSelect.value) {
        case 'price-asc':
            products.sort((a, b) => a.price - b.price);
            break;
        case 'price-desc':
            products.sort((a, b) => b.price - a.price);
            break;
        case 'name':
            products.sort((a, b) => a.name.localeCompare(b.name, 'es'));
            break;
        case 'stock':
            products.sort((a, b) => b.stock - a.stock);
            break;
    }

    productHolder.replaceChildren();
    if (products.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.className = 'empty';
        emptyMessage.textContent = 'No se encontraron productos.';
        productHolder.appendChild(emptyMessage);
        return;
    }

    products.forEach(product => {
        const card = document.createElement('article');
        card.className = 'product-card';
        if (product.stock <= 0) card.classList.add('out-of-stock');

        const image = document.createElement('img');
        image.src = product.image;
        image.alt = product.name;
        image.className = 'product-image';
        image.loading = 'lazy';

        const category = document.createElement('span');
        category.className = 'product-cat';
        category.textContent = product.category;

        const name = document.createElement('h3');
        name.textContent = product.name;

        const titleRow = document.createElement('div');
        titleRow.className = 'product-title-row';
        const brandLogoPath = brandLogos[product.category];
        if (brandLogoPath) {
            const brandLogo = document.createElement('img');
            brandLogo.className = 'product-brand-logo';
            if (product.category === 'Militech') brandLogo.classList.add('brand-logo-militech');
            brandLogo.src = brandLogoPath;
            brandLogo.alt = `${product.category} logo`;
            brandLogo.loading = 'lazy';
            titleRow.appendChild(brandLogo);
        }
        titleRow.appendChild(name);

        const description = document.createElement('p');
        description.textContent = product.description;

        const footer = document.createElement('div');
        footer.className = 'card-footer';

        const price = document.createElement('span');
        price.className = 'price';
        price.textContent = currencyFormatter.format(product.price);

        const stock = document.createElement('span');
        stock.className = 'stock';
        stock.textContent = product.stock > 0 ? `Stock: ${product.stock}` : 'Agotado';

        const addButton = document.createElement('button');
        addButton.className = 'add-to-cart-btn';
        addButton.type = 'button';
        addButton.dataset.productId = product.id;
        addButton.textContent = product.stock > 0 ? 'Añadir a la cesta' : 'Agotado';
        addButton.disabled = product.stock <= 0;

        footer.append(price, stock);
        card.append(image, category, titleRow, description, footer, addButton);
        productHolder.appendChild(card);
    });
}

function updateCart() {
    const itemCount = Array.from(cart.values()).reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = itemCount;
    cartList.replaceChildren();

    if (cart.size === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.className = 'cart-empty';
        emptyMessage.textContent = 'Tu cesta está vacía.';
        cartList.appendChild(emptyMessage);
    }

    let total = 0;
    cart.forEach(item => {
        total += item.product.price * item.quantity;

        const row = document.createElement('div');
        row.className = 'cart-item';

        const name = document.createElement('span');
        name.className = 'item-name';
        name.textContent = item.product.name;

        const quantity = document.createElement('div');
        quantity.className = 'qty';

        const decreaseButton = createCartButton('−', 'decrease', item.product.id, 'Reducir cantidad');
        const quantityLabel = document.createElement('span');
        quantityLabel.textContent = item.quantity;
        const increaseButton = createCartButton('+', 'increase', item.product.id, 'Aumentar cantidad');
        increaseButton.disabled = item.quantity >= item.product.stock;
        const removeButton = createCartButton('Eliminar', 'remove', item.product.id, 'Eliminar producto');
        removeButton.classList.add('remove-btn');

        quantity.append(decreaseButton, quantityLabel, increaseButton);
        row.append(name, quantity, removeButton);
        cartList.appendChild(row);
    });

    cartTotal.textContent = total.toFixed(2);
}

function createCartButton(label, action, productId, accessibleLabel) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.dataset.action = action;
    button.dataset.productId = productId;
    button.setAttribute('aria-label', accessibleLabel);
    return button;
}

function addToCart(productId) {
    const product = allProducts.find(item => item.id === productId);
    if (!product) {
        console.error(`Producto no encontrado: ${productId}`);
        return;
    }
    if (product.stock <= 0) {
        showToast('Este producto está agotado.');
        return;
    }

    const item = cart.get(productId);
    if (item && item.quantity >= product.stock) {
        showToast('No hay más unidades disponibles.');
        return;
    }
    cart.set(productId, { product, quantity: item ? item.quantity + 1 : 1 });
    updateCart();
    showToast('Producto añadido a la cesta.');
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    window.setTimeout(() => toast.remove(), 3000);
}

filterButtons.forEach(button => {
    button.addEventListener('click', () => {
        selectedCategory = button.dataset.category;
        filterButtons.forEach(filter => filter.classList.toggle('active', filter === button));
        renderProducts();
    });
});

searchInput.addEventListener('input', renderProducts);
sortSelect.addEventListener('change', renderProducts);

productHolder.addEventListener('click', event => {
    const button = event.target.closest('.add-to-cart-btn');
    if (button && !button.disabled) {
        addToCart(button.dataset.productId);
    }
});

cartList.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const item = cart.get(button.dataset.productId);
    if (!item) return;

    switch (button.dataset.action) {
        case 'increase':
            if (item.quantity < item.product.stock) item.quantity += 1;
            break;
        case 'decrease':
            item.quantity -= 1;
            if (item.quantity === 0) cart.delete(button.dataset.productId);
            break;
        case 'remove':
            cart.delete(button.dataset.productId);
            break;
    }
    updateCart();
});

cartButton.addEventListener('click', () => {
    cartModal.classList.remove('hidden');
});

function closeCart() {
    cartModal.classList.add('hidden');
}

closeModalButton.addEventListener('click', closeCart);
cartModal.addEventListener('click', event => {
    if (event.target === cartModal) closeCart();
});
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !cartModal.classList.contains('hidden')) closeCart();
});

checkoutButton.addEventListener('click', () => {
    if (cart.size === 0) {
        showToast('Tu cesta está vacía.');
        return;
    }
    if (!customerSelect.value) {
        showToast('Elige un cliente para continuar.');
        return;
    }

    const stockById = Object.fromEntries(allProducts.map(product => [product.id, product.stock]));
    for (const [productId, item] of cart) {
        if (item.quantity > item.product.stock) {
            showToast(`Stock insuficiente para ${item.product.name}.`);
            return;
        }
        stockById[productId] -= item.quantity;
    }

    if (!saveStock(stockById)) return;

    allProducts.forEach(product => {
        product.stock = stockById[product.id];
    });
    cart.clear();
    renderProducts();
    updateCart();
    closeCart();
    showToast(`Compra finalizada para ${customerSelect.value}. El stock se ha actualizado.`);
});

updateCart();
