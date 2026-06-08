// ========== APPLICATION CONFIGURATION GLOBAL LAYER ==========
const APPS_SCRIPT_ENDPOINT = "https://script.google.com/macros/s/AKfycbzjD-FHGNgCO5VWJPK1wOgSHtwJaANgtOccV_cTCsieZjRM3-itUbuBAZLvoZXKJhlh/exec"; 
const ADMIN_MASTER_TOKEN = "Admin123"; // Customize this token to log into the hidden system panel

let productsDB = [];
let cart = [];
let currentOrderData = null;

// ========== REFRESH & HYDRATE DATA MATRIX ENGINE ==========
async function pullDynamicCatalog() {
    try {
        const response = await fetch(APPS_SCRIPT_ENDPOINT, {
            method: "GET",
            cache: "no-store"
        });
        if (!response.ok) throw new Error(`HTTP Session Error: ${response.status}`);
        const data = await response.json();
        
        productsDB = data.map(item => ({
            id: String(item.id),
            name: String(item.name),
            price: parseFloat(item.price) || 0.00,
            image: String(item.image),
            fallback: item.fallback || `https://placehold.co/400x500/1a1a1a/gold?text=${encodeURIComponent(item.name || 'Product')}`
        }));
        
        buildStorefrontGrid();
        console.log(`🛒 Dynamic Catalog sync achieved: ${productsDB.length} luxury elements online.`);
    } catch (err) {
        console.error("Critical Catalog Injection Failure:", err);
        showToast("Error refreshing live products grid.", true);
    }
}

// ========== STOREFRONT VIEW INJECTOR ==========
function buildStorefrontGrid() {
    const grid = document.getElementById("productsGrid");
    if (!grid) return;
    grid.innerHTML = "";

    if (productsDB.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:60px; color:#A6A097;">✦ Continuous Inventory Refreshing — Drop Impending ✦</div>`;
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

// ========== TRANSACTION CART CONTROL CORE ==========
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
        container.innerHTML = `<div style="text-align:center; padding:40px; color:#A6A097; font-size:0.95rem;">Your bag is currently empty.</div>`;
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
                        <button class="remove-item-btn" data-id="${item.id}"><i class="fas fa-trash"></i> Delete</button>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = markup;
    if(totalHUD) totalHUD.innerText = `GHS ${computeCartTotal().toFixed(2)}`;

    // Attach Context Events inside Sidebar Frame Drawer
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

// ========== OVERLAY VIEW TOGGLE CONTROLLERS ==========
function toggleSidebarState(open = true) {
    const sidebar = document.getElementById("cartSidebar");
    const overlay = document.getElementById("cartOverlay");
    if(open) {
        sidebar.classList.add("open");
        overlay.classList.add("active");
        document.body.style.overflow = "hidden";
    } else {
        sidebar.classList.remove("open");
        overlay.classList.remove("active");
        document.body.style.overflow = "";
    }
}

function renderCheckoutModal(show = true) {
    const modal = document.getElementById("checkoutModal");
    if(!show) { modal.classList.remove("active"); return; }
    if(cart.length === 0) { showToast("Bag must contain items to trigger checkout.", true); return; }
    
    toggleSidebarState(false);
    
    const checkoutItemsBox = document.getElementById("checkoutItemsList");
    const modalTotal = document.getElementById("modalTotalSummary");
    
    let summaryMarkup = "";
    cart.forEach(i => {
        summaryMarkup += `
            <div class="checkout-item">
                <span>${i.name} (x${i.quantity})</span>
                <span>GHS ${(i.price * i.quantity).toFixed(2)}</span>
            </div>
        `;
    });
    
    checkoutItemsBox.innerHTML = summaryMarkup;
    modalTotal.innerText = `Total Settlement Amount: GHS ${computeCartTotal().toFixed(2)}`;
    modal.classList.add("active");
}

// ========== TRANSACTION ORDER ENGINE PLACEMENT ROUTER ==========
function initializeOrderProcessing() {
    const name = document.getElementById("customerName").value.trim();
    const email = document.getElementById("customerEmail").value.trim();
    const phone = document.getElementById("customerPhone").value.trim();
    const address = document.getElementById("customerAddress").value.trim();
    const notes = document.getElementById("orderNotes").value.trim();
    const method = document.querySelector('input[name="paymentMethod"]:checked').value;

    if (!name || !email || !phone || !address) {
        showToast("Please fully provide all core layout fields (*).", true);
        return;
    }

    currentOrderData = {
        action: "placeOrder",
        orderId: "SC-" + Math.floor(100000 + Math.random() * 900000),
        date: new Date().toLocaleString(),
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        deliveryAddress: address,
        orderNotes: notes,
        items: cart,
        total: computeCartTotal(),
        paymentMethod: method,
        status: method === "whatsapp" ? "Pay on Delivery (Unconfirmed)" : "Pending Payment Gateway Verification"
    };

    if(method === "paystack") {
        executePaystackInlineGate(currentOrderData);
    } else {
        dispatchWhatsAppLinkString(currentOrderData);
    }
}

// ========== PAYMENT PATHWAY GATEWAYS ENGINE ==========
function executePaystackInlineGate(order) {
    const handler = PaystackPop.setup({
        key: 'pk_live_your_actual_key_here', // Insert your actual live key here
        email: order.customerEmail,
        amount: Math.round(order.total * 100), 
        currency: "GHS",
        ref: order.orderId,
        metadata: {
            custom_fields: [
                { display_name: "Customer Phone", variable_name: "customer_phone", value: order.customerPhone }
            ]
        },
        callback: function(response) {
            order.status = "Paid via Paystack Secure Gateway";
            order.gatewayRef = response.reference;
            postOrderPayloadToSheets(order);
            generateInvoiceBill(order);
            clearBagState();
        },
        onClose: function() {
            showToast("Secure checkout line disconnected.", true);
        }
    });
    handler.openIframe();
}

function dispatchWhatsAppLinkString(order) {
    postOrderPayloadToSheets(order);
    generateInvoiceBill(order);
    
    let stringBuffer = `*SUCCESS COLLECTION ORDER — ${order.orderId}*\n\n`;
    stringBuffer += `*Client:* ${order.customerName}\n`;
    stringBuffer += `*Phone:* ${order.customerPhone}\n`;
    stringBuffer += `*Delivery Dest:* ${order.deliveryAddress}\n`;
    if(order.orderNotes) stringBuffer += `*Special Notes:* ${order.orderNotes}\n`;
    stringBuffer += `\n*📦 ARCHITECTURE MANIFEST:* \n`;
    
    order.items.forEach(i => {
        stringBuffer += `• ${i.name} (x${i.quantity}) -> GHS ${(i.price * i.quantity).toFixed(2)}\n`;
    });
    
    stringBuffer += `\n*TOTAL STATEMENT SUM:* GHS ${order.total.toFixed(2)}\n`;
    stringBuffer += `*Payment Routing:* Pay On Delivery Requested\n\n`;
    stringBuffer += `Please review order layout and dispatch availability timings.`;

    const targetStoreLine = "233540196090"; 
    clearBagState();
    window.open(`https://wa.me/${targetStoreLine}?text=${encodeURIComponent(stringBuffer)}`, '_blank');
}

// ========== BACKEND SHEET SYNC TRANSMITTER ==========
function postOrderPayloadToSheets(payload) {
    fetch(APPS_SCRIPT_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    }).catch(err => console.warn("Background order sheet sync dropped:", err));
}

function clearBagState() {
    cart = [];
    commitCartState();
    renderCheckoutModal(false);
}

// ========== PREMIUM INVOICE LAYOUT MAKER ==========
function generateInvoiceBill(order) {
    const canvas = document.getElementById("receiptContent");
    if(!canvas) return;

    let itemsTemplateRows = "";
    order.items.forEach(i => {
        itemsTemplateRows += `
            <tr>
                <td style="padding:10px 0; border-bottom:1px solid #e5e5e5; font-size:0.95rem;">${i.name} <strong>x${i.quantity}</strong></td>
                <td style="padding:10px 0; text-align:right; border-bottom:1px solid #e5e5e5; font-size:0.95rem;">GHS ${(i.price * i.quantity).toFixed(2)}</td>
            </tr>
        `;
    });

    canvas.innerHTML = `
        <div id="pdfCaptureFrame" style="padding:15px; font-family:'Inter',sans-serif; color:#111;">
            <div style="text-align:center; margin-bottom:25px;">
                <h2 style="margin:0; font-size:1.5rem; letter-spacing:1px; font-weight:700;">SUCCESS COLLECTION</h2>
                <p style="margin:4px 0 0; font-size:0.8rem; color:#666; text-transform:uppercase; letter-spacing:2px;">Luxury Streetwear Statement</p>
            </div>
            <div style="font-size:0.9rem; line-height:1.5; margin-bottom:20px;">
                <p><strong>Invoice Identifier:</strong> ${order.orderId}</p>
                <p><strong>System Timestamp:</strong> ${order.date}</p>
                <p><strong>Settlement Mode:</strong> ${order.paymentMethod.toUpperCase()}</p>
            </div>
            <hr style="border:none; border-top:1px dashed #ccc; margin:15px 0;">
            <div style="font-size:0.9rem; line-height:1.5; margin-bottom:20px;">
                <p style="text-transform:uppercase; font-size:0.75rem; color:#666; font-weight:700; margin-bottom:5px;">Consignee Destination Address</p>
                <p><strong>${order.customerName}</strong></p>
                <p>${order.customerPhone}</p>
                <p>${order.deliveryAddress}</p>
            </div>
            <table style="width:100%; border-collapse:collapse; margin-top:20px;">
                <thead>
                    <tr>
                        <th style="text-align:left; padding-bottom:8px; border-bottom:2px solid #111; font-size:0.85rem; text-transform:uppercase;">Item Description</th>
                        <th style="text-align:right; padding-bottom:8px; border-bottom:2px solid #111; font-size:0.85rem; text-transform:uppercase;">Subtotal</th>
                    </tr>
                </thead>
                <tbody>${itemsTemplateRows}</tbody>
            </table>
            <div style="margin-top:25px; text-align:right;">
                <p style="margin:0; font-size:0.85rem; color:#666;">Grand Statement Total</p>
                <h3 style="margin:4px 0 0; font-size:1.4rem; font-weight:700;">GHS ${order.total.toFixed(2)}</h3>
                <p style="margin:4px 0 0; font-size:0.75rem; color:#333;">Processing Status: ${order.status}</p>
            </div>
            <div style="text-align:center; margin-top:40px; border-top:1px solid #eee; padding-top:20px; font-size:0.75rem; color:#888;">
                <p>Thank you for shopping luxury retail variants with Success Collection.</p>
                <p style="margin-top:4px; font-size:0.7rem; color:#aaa;">Framework System Matrix Architecture Provided via Azz Internet Hub</p>
            </div>
        </div>
    `;

    document.getElementById("receiptModal").classList.add("active");
}

function downloadInvoicePDF() {
    const target = document.getElementById("pdfCaptureFrame");
    if(!target || !currentOrderData) return;
    const rules = {
        margin: 12,
        filename: `SuccessCollection_Invoice_${currentOrderData.orderId}.pdf`,
        image: { type: 'jpeg', quality: 0.99 },
        html2canvas: { scale: 2.5, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(rules).from(target).save();
}

// ========== SELLER INTERFACE ADMIN CENTER ENGINE ==========
function toggleAdminPortalView(open = true) {
    const modal = document.getElementById("adminPortalModal");
    if(open) {
        document.getElementById("adminAuthLockScreen").classList.remove("hidden-view");
        document.getElementById("adminDashboardView").classList.add("hidden-view");
        document.getElementById("adminPasswordInput").value = "";
        modal.classList.add("active");
    } else {
        modal.classList.remove("active");
    }
}

function handleAdminAuthorization() {
    const input = document.getElementById("adminPasswordInput").value;
    if(input === ADMIN_MASTER_TOKEN) {
        document.getElementById("adminAuthLockScreen").classList.add("hidden-view");
        document.getElementById("adminDashboardView").classList.remove("hidden-view");
        showToast("Administrative Clearance Authenticated.");
    } else {
        showToast("Invalid Credentials Token Key.", true);
    }
}

async function uploadProductFromDashboard() {
    const name = document.getElementById("adminProdName").value.trim();
    const price = parseFloat(document.getElementById("adminProdPrice").value);
    const id = document.getElementById("adminProdId").value.trim();
    const imgUrl = document.getElementById("adminProdImg").value.trim();

    if(!name || !price || !id || !imgUrl) {
        showToast("Complete all fields before publishing.", true);
        return;
    }

    const payload = {
        action: "addProduct",
        id: id,
        name: name,
        price: price,
        image: imgUrl,
        fallback: ""
    };

    showToast("Publishing product drop to Sheet...");
    
    try {
        await fetch(APPS_SCRIPT_ENDPOINT, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        
        showToast("Product successfully uploaded!", false);
        document.getElementById("adminAddProductForm").reset();
        toggleAdminPortalView(false);
        // Refresh catalog view instantly
        await pullDynamicCatalog();
    } catch(err) {
        showToast("Error processing front-end catalog update.", true);
    }
}

// ========== HUD GRAPHICS DISPLAY NOTIFICATIONS ENGINE ==========
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

// ========== COMPREHENSIVE ROUTER EVENT listeners ENGINE ==========
function compileInteractiveEventListeners() {
    // Navigation Drawer UI Triggers
    document.getElementById("cartIcon").addEventListener("click", () => toggleSidebarState(true));
    document.getElementById("closeCartBtn").addEventListener("click", () => toggleSidebarState(false));
    document.getElementById("cartOverlay").addEventListener("click", () => toggleSidebarState(false));

    // Checkout Flow Lifecycle
    document.getElementById("proceedCheckoutBtn").addEventListener("click", () => renderCheckoutModal(true));
    document.getElementById("closeCheckoutBtn").addEventListener("click", () => renderCheckoutModal(false));
    document.getElementById("placeOrderBtn").addEventListener("click", initializeOrderProcessing);

    // Invoice Post-Checkout Interaction Handlers
    document.getElementById("closeReceiptBtn").addEventListener("click", () => document.getElementById("receiptModal").classList.remove("active"));
    document.getElementById("continueShoppingBtn").addEventListener("click", () => document.getElementById("receiptModal").classList.remove("active"));
    document.getElementById("downloadReceiptBtn").addEventListener("click", downloadInvoicePDF);

    // Admin Dashboard Layer Triggers
    document.getElementById("adminPortalTrigger").addEventListener("click", () => toggleAdminPortalView(true));
    document.getElementById("closeAdminBtn").addEventListener("click", () => toggleAdminPortalView(false));
    document.getElementById("verifyAdminTokenBtn").addEventListener("click", handleAdminAuthorization);
    document.getElementById("submitNewProductToSheetBtn").addEventListener("click", uploadProductFromDashboard);

    // Media Lightbox Close Toggles
    const lightbox = document.getElementById("imageModal");
    lightbox.addEventListener("click", () => lightbox.classList.remove("active"));

    // Floating UI Anchor Configuration Setup
    const floatWA = document.getElementById("whatsappFloatBtn");
    if(floatWA) {
        floatWA.setAttribute("href", "https://wa.me/233540196090");
        floatWA.setAttribute("target", "_blank");
    }
}

// ========== LIFECYCLE ENGINE INITIALIZER ==========
async function bootPlatformContext() {
    compileInteractiveEventListeners();
    loadCachedCartState();
    await pullDynamicCatalog();
    
    // Core Background Pooling Thread Interval (Sync catalog adjustments every 60s)
    setInterval(pullDynamicCatalog, 60000);
}

document.addEventListener("DOMContentLoaded", bootPlatformContext);
