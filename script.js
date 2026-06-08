const APPS_SCRIPT_ENDPOINT = "https://script.google.com/macros/s/AKfycbwW7eN12oTHnGFLwnjxz0TKp_V_D_hdt6kuyDmVrTh0vnLyG0fAByX1FMT5-qrx3wlQ/exec"; 
const PAYSTACK_PUBLIC_KEY = "pk_live_your_actual_key_here"; // Put your actual Paystack public key here

let productsDB = [];
let cart = [];

async function pullDynamicCatalog() {
    try {
        const response = await fetch(APPS_SCRIPT_ENDPOINT, { method: "GET" });
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        const data = await response.json();
        
        productsDB = data.map(item => ({
            id: String(item.id),
            name: String(item.name),
            price: parseFloat(item.price) || 0.00,
            image: String(item.image),
            fallback: item.fallback || `https://placehold.co/400x500/1a1a1a/gold?text=${encodeURIComponent(item.name || 'Product')}`
        }));
        
        buildStorefrontGrid();
    } catch (err) {
        console.error("Critical Catalog Failure:", err);
        showToast("Error refreshing live products grid.", true);
    }
}

function buildStorefrontGrid() {
    const grid = document.getElementById("productsGrid");
    if (!grid) return;
    grid.innerHTML = "";

    if (productsDB.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:60px; color:#A6A097;">✦ Updating Inventory — Drop Impending ✦</div>`;
        return;
    }

    productsDB.forEach(prod => {
        const element = document.createElement("div");
        element.className = "product-card";
        element.innerHTML = `
            <img class="product-img" src="${prod.image}" alt="${prod.name}" onerror="this.src='${prod.fallback}'" loading="lazy">
            <div class="price-overlay">GHS ${prod.price.toFixed(2)}</div>
            <div class="product-info">
                <div class="product-title">${prod.name}</div>
                <button class="add-to-cart" data-id="${prod.id}">Add To Bag</button>
            </div>
        `;

        element.querySelector(".product-img").addEventListener("click", () => {
            document.getElementById("modalImg").src = prod.image;
            document.getElementById("imageModal").classList.add("active");
        });

        element.querySelector(".add-to-cart").addEventListener("click", (e) => {
            e.stopPropagation();
            addItemToCart(prod);
        });

        grid.appendChild(element);
    });
}

function commitCartState() {
    localStorage.setItem("successCollection_Bag", JSON.stringify(cart));
    recalculateCartInterface();
}

function loadCachedCartState() {
    const raw = localStorage.getItem("successCollection_Bag");
    cart = raw ? JSON.parse(raw) : [];
    recalculateCartInterface();
}

function addItemToCart(product) {
    const match = cart.find(i => String(i.id) === String(product.id));
    if (match) {
        match.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    commitCartState();
    showToast(`Added ${product.name} to luxury bag.`);
}

function updateItemQuantity(id, modifier) {
    const idx = cart.findIndex(i => String(i.id) === String(id));
    if (idx !== -1) {
        cart[idx].quantity += modifier;
        if (cart[idx].quantity <= 0) cart.splice(idx, 1);
        commitCartState();
    }
}

function computeCartTotal() {
    return cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
}

function recalculateCartInterface() {
    const countHUD = document.getElementById("cartCount");
    const container = document.getElementById("cartItemsList");
    const totalHUD = document.getElementById("cartTotal");

    const totalCount = cart.reduce((acc, item) => acc + item.quantity, 0);
    if(countHUD) countHUD.innerText = totalCount;

    if (!container) return;
    if (cart.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:40px; color:#A6A097; font-size:0.95rem;">Your bag is empty.</div>`;
        if(totalHUD) totalHUD.innerText = "GHS 0.00";
        return;
    }

    let markup = "";
    cart.forEach(item => {
        markup += `
            <div class="cart-item">
                <img src="${item.image}" onerror="this.src='${item.fallback}'">
                <div class="cart-item-details">
                    <div class="cart-item-title"><strong>${item.name}</strong></div>
                    <div class="cart-item-price">GHS ${item.price.toFixed(2)}</div>
                    <div class="cart-action-row">
                        <div class="qty-controls">
                            <button class="qty-btn" data-id="${item.id}" data-action="decrease">-</button>
                            <span style="padding:0 8px; font-size:0.9rem;">${item.quantity}</span>
                            <button class="qty-btn" data-id="${item.id}" data-action="increase">+</button>
                        </div>
                        <button class="remove-item-btn" data-id="${item.id}"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = markup;
    if(totalHUD) totalHUD.innerText = `GHS ${computeCartTotal().toFixed(2)}`;

    container.querySelectorAll(".qty-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const mod = btn.dataset.action === "increase" ? 1 : -1;
            updateItemQuantity(btn.dataset.id, mod);
        });
    });

    container.querySelectorAll(".remove-item-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            cart = cart.filter(i => String(i.id) !== String(btn.dataset.id));
            commitCartState();
        });
    });
}

function toggleSidebarState(open = true) {
    const sidebar = document.getElementById("cartSidebar");
    const overlay = document.getElementById("cartOverlay");
    if(open) {
        sidebar.classList.add("open");
        overlay.classList.add("active");
    } else {
        sidebar.classList.remove("open");
        overlay.classList.remove("active");
    }
}

function renderCheckoutModal(show = true) {
    const modal = document.getElementById("checkoutModal");
    if(!show) { modal.classList.remove("active"); return; }
    if(cart.length === 0) { showToast("Bag is empty.", true); return; }
    
    toggleSidebarState(false);
    const checkoutItemsBox = document.getElementById("checkoutItemsList");
    const modalTotal = document.getElementById("modalTotalSummary");
    
    let summaryMarkup = "";
    cart.forEach(i => {
        summaryMarkup += `<div class="checkout-item"><span>${i.name} (x${i.quantity})</span><span>GHS ${(i.price * i.quantity).toFixed(2)}</span></div>`;
    });
    
    checkoutItemsBox.innerHTML = summaryMarkup;
    modalTotal.innerText = `Total: GHS ${computeCartTotal().toFixed(2)}`;
    modal.classList.add("active");
}

function initializeOrderProcessing() {
    const name = document.getElementById("customerName").value.trim();
    const email = document.getElementById("customerEmail").value.trim();
    const phone = document.getElementById("customerPhone").value.trim();
    const address = document.getElementById("customerAddress").value.trim();
    const method = document.querySelector('input[name="paymentMethod"]:checked').value;

    if (!name || !email || !phone || !address) {
        showToast("Please complete all required fields.", true);
        return;
    }

    const orderData = {
        action: "placeOrder",
        orderId: "SC-" + Math.floor(100000 + Math.random() * 900000),
        date: new Date().toLocaleString(),
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        deliveryAddress: address,
        items: cart,
        total: computeCartTotal(),
        paymentMethod: method,
        status: method === "whatsapp" ? "Pay on Delivery" : "Paid via Paystack"
    };

    if(method === "paystack") {
        executePaystackPayment(orderData);
    } else {
        dispatchWhatsAppOrder(orderData);
    }
}

function executePaystackPayment(order) {
    const handler = PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: order.customerEmail,
        amount: Math.round(order.total * 100), 
        currency: "GHS",
        ref: order.orderId,
        callback: function(response) {
            postOrderToSheets(order);
            clearBagState();
            showToast("Payment Successful! Order logged.");
            setTimeout(() => dispatchWhatsAppOrder(order), 1500);
        },
        onClose: function() {
            showToast("Payment cancelled.", true);
        }
    });
    handler.openIframe();
}

function dispatchWhatsAppOrder(order) {
    if(order.paymentMethod === "whatsapp") {
        postOrderToSheets(order);
        clearBagState();
    }
    
    let text = `*SUCCESS COLLECTION ORDER — ${order.orderId}*\n\n`;
    text += `*Name:* ${order.customerName}\n*Phone:* ${order.customerPhone}\n*Delivery:* ${order.deliveryAddress}\n\n*ITEMS:* \n`;
    order.items.forEach(i => { text += `• ${i.name} (x${i.quantity})\n`; });
    text += `\n*TOTAL:* GHS ${order.total.toFixed(2)}\n*Payment:* ${order.status}`;

    window.open(`https://wa.me/233540196090?text=${encodeURIComponent(text)}`, '_blank');
}

function postOrderToSheets(payload) {
    fetch(APPS_SCRIPT_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    }).catch(err => console.warn("Background sheet sync failed:", err));
}

function clearBagState() {
    cart = [];
    commitCartState();
    renderCheckoutModal(false);
}

function showToast(message, isError = false) {
    const current = document.querySelector(".toast-notification");
    if (current) current.remove();

    const HUD = document.createElement("div");
    HUD.className = "toast-notification";
    HUD.style.background = isError ? "#A94442" : "var(--accent-gold)";
    HUD.style.color = isError ? "#FFFFFF" : "var(--bg-primary)";
    HUD.innerHTML = `<i class="fas ${isError ? 'fa-triangle-exclamation' : 'fa-circle-check'}"></i> <span>${message}</span>`;
    document.body.appendChild(HUD);

    setTimeout(() => { if (HUD.parentNode) HUD.remove(); }, 3500);
}

function compileInteractiveEventListeners() {
    document.getElementById("cartIcon").addEventListener("click", () => toggleSidebarState(true));
    document.getElementById("closeCartBtn").addEventListener("click", () => toggleSidebarState(false));
    document.getElementById("cartOverlay").addEventListener("click", () => toggleSidebarState(false));
    document.getElementById("proceedCheckoutBtn").addEventListener("click", () => renderCheckoutModal(true));
    document.getElementById("closeCheckoutBtn").addEventListener("click", () => renderCheckoutModal(false));
    document.getElementById("placeOrderBtn").addEventListener("click", initializeOrderProcessing);
    document.getElementById("imageModal").addEventListener("click", () => document.getElementById("imageModal").classList.remove("active"));

    const floatWA = document.getElementById("whatsappFloatBtn");
    if(floatWA) floatWA.setAttribute("href", "https://wa.me/233540196090");
}

document.addEventListener("DOMContentLoaded", () => {
    compileInteractiveEventListeners();
    loadCachedCartState();
    pullDynamicCatalog();
});
