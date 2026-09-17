console.clear();
console.log("Mã được tạo vào ngày 16/09/2026 bởi HiepDz");
console.log("");

function initDropdownComponent(selector) {
    const dropdowns = document.querySelectorAll(selector);
    dropdowns.forEach(container => {
        const selectBtn = container.querySelector(".toggle-dropdown");
        const optionsList = container.querySelector(".option-list");
        const items = container.querySelectorAll(".option-list span");
        if (!selectBtn || !optionsList) return;
        selectBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            document.querySelectorAll(".option-list").forEach(list => {
                if (list !== optionsList) list.classList.remove("is-open");
            });
            optionsList.classList.toggle("is-open");
        });
        items.forEach(item => {
            item.addEventListener("click", () => {
                const value = item.getAttribute("data-value");
                const text = item.textContent;
                selectBtn.textContent = text;
                optionsList.classList.remove("is-open");
            });
        });
    });
    document.addEventListener("click", () => {
        document.querySelectorAll(".option-list").forEach(list => {
            list.classList.remove("is-open");
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    initDropdownComponent(".option-select-list");
});