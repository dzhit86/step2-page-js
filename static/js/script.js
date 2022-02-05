'use strict';
class AdManager {
    static containerPopup = document.querySelector("#adPopup");
    static popupCloseButtons = AdManager.containerPopup.querySelectorAll("._closePopup");

    popupTitle = AdManager.containerPopup.querySelector(".popup__title");
    popupBody = AdManager.containerPopup.querySelector(".popup__body");
    popupContent = AdManager.containerPopup.querySelector(".popup__content");
    popupButtons = AdManager.containerPopup.querySelector(".popup__buttons");
    popupMessages = AdManager.containerPopup.querySelector(".popup__message");

    id;
    articleType;
    attrName; // attribute field name
    articleTypeSelector; //data-ad-type=
    articleTextFields; //data-ad-state= + .selector
    serverHundler;
    csrfToken;
    popupData;
    dataSend = new Object();

    /**
    * Класс: Управление рекламными объявлениями
    * @param {String} params.articleType Параметр атрибута data-ad-type, указывающий на тип операции.
    * @param {String} params.serverHundler Адрес серверного обработчика.
    * @param {Object} params.articleTextFields Объект, в котором ключ - статус записи, а значение - массив (возможно двумерный), первый ключ которого - селектор изменяемого DOM элемента, а второй - текстовое значение. В случае, если ключ имеет вид "path", то его значение подставляется напрямую в тело соответствующего элемента.
    * @param {Object} params.popupData Объект, содержащий данные для Popup.
    * @param {String} params.popupData.title Заголовок Popup.
    * @param {String} params.popupData.type Тип контента Popup.
    * @param {Object} params.popupData.[type_name] Объект со специфическими свойствами, зависимыми от типа контента Popup.
    * @param {String} params.popupData.[type_name].send Надпись кнопки отправления данных на сервер.
    * @param {Object} params.popupData.[type_name].message Объект, где ключ - ответ сервера, а значение - его текстовая интерпретация.
    * @param {Object} params.popupData.[type_name].data JSON-данные, необходимые для формирования запроса на сервер (напр. Select с пунктами).
    * 
    */
    constructor(params) {
        if (params.articleType && params.articleType !== "" && typeof params.articleType === "string") { 
            this.articleTypeSelector = `[data-ad-type="${params.articleType}"]`;
            this.articleType = params.articleType;
        } else { throw new Error('Параметр articleSelector обязателен и должен являться строкой.')  }
        
        if (params.serverHundler && params.serverHundler !== "" && typeof params.serverHundler === "string") { 
            this.serverHundler = params.serverHundler;            
        } else { throw new Error('Параметр serverHundler обязателен и должен являться строкой.')  }
        
        if (params.csrf_token && params.csrf_token !== "" && typeof params.csrf_token === "string") { 
            this.csrfToken = params.csrf_token;            
        } else { throw new Error('Параметр csrf_token обязателен и должен являться строкой.')  }
        
        if (params.attrName && params.attrName !== "" && typeof params.attrName === "string") { 
            this.attrName = params.attrName;           
        }

        if (params.articleTextFields && Object.keys(params.articleTextFields).length !== 0 && typeof params.articleTextFields === "object") { 
            this.articleTextFields = params.articleTextFields;           
        }
        
        if (params.popupData && Object.keys(params.popupData).length !== 0 && typeof params.popupData === "object") { 
            if (!params.popupData.title || params.popupData.title === "" || typeof params.popupData.title !== "string") {
                throw new Error('Параметр title в объекте popupData обязателен и должен являться строкой.')
            }
            if (!params.popupData.type || params.popupData.type === "" || typeof params.popupData.type !== "string") {
                throw new Error('Параметр type в объекте popupData обязателен и должен являться строкой.')
            }
            const typeObject = params.popupData.type;
            if (!params.popupData[typeObject] || Object.keys(params.popupData[typeObject]).length === 0 || typeof params.popupData[typeObject] !== "object") { 
                throw new Error(`Параметр ${params.popupData[typeObject]} в объекте popupData обязателен и должен являться объектом.`)
            }
            this.popupData = params.popupData;
        } else { throw new Error('Параметр popupData обязателен и должен являться объектом.')  }

        this.#setListener();
        this.setTextFields();
    }

    // Установка наблюдения за кнопками открытия и закрытия popup.
     #setListener(){
        const popupOpenButtons = document.querySelectorAll( this.articleTypeSelector );
        popupOpenButtons.forEach( selector => {
            let button;
            selector.tagName === "BUTTON" ? button = selector : button = selector.querySelector("button");
            button.addEventListener("click", event => {
                event.preventDefault();                
                this.id = event.target.closest("article").getAttribute("id");
                this.#handlingPopupOpening();
            });
        });
        AdManager.popupCloseButtons.forEach( selector => {
            selector.addEventListener("click", event => {
                event.preventDefault();
                this.#handlingPopupClosure();
            });
        });
        document.addEventListener("mouseup", event => {
            if (event.target === AdManager.containerPopup) this.#handlingPopupClosure();
        });
    }
    // Действия при закрытии popup.
    #handlingPopupClosure() {
        AdManager.containerPopup.classList.remove("_active");
        AdManager.containerPopup.querySelector(".popup__message").classList.remove("_active");
        this.popupTitle.innerHTML = "";
        this.popupContent.innerHTML = "";
        this.popupButtons.innerHTML = "";
        AdManager.containerPopup.setAttribute("data-ad-send", "");
        this.popupMessages.classList.remove("_active");
        this.popupMessages.querySelector(".popup__title_message").innerHTML = "";
        this.popupMessages.querySelector(".popup__content_message").innerHTML = "";
        this.popupMessages.querySelector(".popup__buttons_message").innerHTML = "";
        if ( AdManager.containerPopup.querySelector("#adPopupSend") ) AdManager.containerPopup.querySelector("#adPopupSend").remove();
    }
    // Действия при открытии popup.
    #handlingPopupOpening() {
        if( this.popupData.type === "confirm" ) this.#createPopupTypeConfirm();
        if( this.popupData.type === "select" ) this.#createPopupTypeSelect();
        if( this.popupData.type === "payment" ) this.#createPopupTypePayment();
        if( this.popupData.type === "action" ) this.#createPopupTypeAction();        
    }
    // Формирование содержимого popup.
    #createPopupTypeConfirm() {
        // Формирование JSON для отправки с размещением в атрибуте popup.
        this.dataSend["ad_id"] = this.id;
        this.dataSend[this.articleType] = this.getReverseValueTypeArticle(this.id, this.articleType, "key");
        AdManager.containerPopup.setAttribute("data-ad-send", JSON.stringify(this.dataSend));        
        // Формирование содержимого popup.
        this.popupTitle.innerHTML = this.popupData.title.replace("$inc", this.getValueTypeArticle(this.id, this.articleType, "value"));      
        const sendButton = this.#createSendButton(this.popupData.confirm.send);
        this.#createCancelButton()
        AdManager.containerPopup.classList.add("_active");
        // Отправка данных.
        sendButton.addEventListener("click", element => {
            element.preventDefault();           
            AdManager.#sendPostData(this.csrfToken, this.serverHundler, this.dataSend)
                .then((data) => {
                    const buttonText = this.popupData.confirm.send;
                    const button = this.#createCancelButton(buttonText, this.popupMessages.querySelector(".popup__buttons_message"));
                    let title;
                    if( data.success ) {
                        title = this.popupData.confirm.message.success.replace("$inc", this.getReverseValueTypeArticle(this.id, this.articleType, "value"));
                        this.setTextFields(this.dataSend["ad_id"], this.dataSend[this.articleType]);
                        //this.setTextFields(data["ad_id"], data["tariff_id"]);
                    } else {
                        title = this.popupData.confirm.message.error.replace("$inc", data.error);                    
                    }           
                    this.#createConfirmBlock(title);         
                    button.addEventListener("click", event => {
                        event.preventDefault();
                        this.#handlingPopupClosure();
                    });
                });
        });
    }
    #createPopupTypeSelect() {
        this.popupTitle.innerHTML = this.popupData.title;
        // JSON.parse(this.popupData.select.data);
        const selectHtml = this.#createSelectContent(this.popupData.select.data);
        const changeButton = this.#createSendButton(this.popupData.select.send);
        const confirmButton = this.#createSendButton(this.popupData.select.confirm, "popup__button popup__button--main", this.popupMessages.querySelector(".popup__buttons_message"));
        let currentOption = selectHtml.value;
        selectHtml.addEventListener("change", event => {
            event.preventDefault();
            const oldList = this.popupContent.querySelector("ul");
            const currentItem = selectHtml.querySelector(`[value="${selectHtml.value}"]`);
            const newList = this.#createListContent(this.popupData.select.data, selectHtml.value);
            oldList.replaceWith(newList)
            currentOption = selectHtml.value;
        });        
        changeButton.addEventListener("click", event => {
            event.preventDefault();
            // Формирование JSON для отправки с размещением в атрибуте popup.
            this.dataSend["ad_id"] = this.id;
            this.dataSend["tariff_id"] = currentOption;
            AdManager.containerPopup.setAttribute("data-ad-send", JSON.stringify(this.dataSend));
            this.#createConfirmBlock(this.popupData.select.message.title);
            this.#createCancelButton(this.popupData.select.cancel, this.popupMessages.querySelector(".popup__buttons_message"));
            this.popupContent.innerHTML = "";
        });
        confirmButton.addEventListener("click", event => {
            event.preventDefault();
            AdManager.#sendPostData(this.csrfToken, this.serverHundler, this.dataSend)
            .then((data) => {
                this.popupMessages.querySelector(".popup__title_message").innerHTML = "";
                this.popupMessages.querySelector(".popup__buttons_message").innerHTML = "";
                const buttonText = "Ok";
                const button = this.#createCancelButton(buttonText, this.popupMessages.querySelector(".popup__buttons_message"));
                if( data.success ) {
                    const title = this.popupData.select.message.success;
                    this.popupMessages.querySelector(".popup__title_message").innerHTML = title;
                    this.setTextFields(this.dataSend["ad_id"], this.dataSend["tariff_id"]);
                    //this.setTextFields(data["ad_id"], data["tariff_id"]);
                } else {
                    let title = this.popupData.select.message.error.replace("$inc", data.error);            
                    this.popupMessages.querySelector(".popup__title_message").innerHTML = title;
                }
                button.addEventListener("click", event => {
                    event.preventDefault();
                    this.#handlingPopupClosure();
                });                 
            });
        });
        AdManager.containerPopup.classList.add("_active");
    }
    #createPopupTypePayment() {
        this.popupTitle.innerHTML = this.popupData.title;
        // JSON.parse(this.popupData.select.data);
        const itemSelector = this.#createPaymentContent(this.popupData.payment.data);
        AdManager.containerPopup.querySelectorAll(itemSelector).forEach( item => {
            item.addEventListener("click", event => {
                event.preventDefault();
                // Формирование JSON для отправки с размещением в атрибуте popup.
                this.dataSend["ad_id"] = this.id;
                this.dataSend["payment_method"] = "Stripe";
                this.dataSend["amount"] = item.getAttribute("data-ad-amount");
                AdManager.#sendPostData(this.csrfToken, this.serverHundler, this.dataSend)
                    .then((data) => {
                        const button = this.#createCancelButton("Ok", this.popupMessages.querySelector(".popup__buttons_message"));
                        let title;
                        if( data.success ) {
                            this.#handlingPopupClosure();
                            window.location.href = data.redirect_to;
                        } else {
                            title = this.popupData.payment.error.replace("$inc", data.error);                    
                        }           
                        this.#createConfirmBlock(title);         
                        this.popupContent.innerHTML = "";
                        button.addEventListener("click", event => {
                            event.preventDefault();
                            this.#handlingPopupClosure();
                        });
                    });
            });
        });

        AdManager.containerPopup.classList.add("_active");
    }
    #createPopupTypeAction() {
        // Формирование JSON для отправки с размещением в атрибуте popup.
        this.dataSend["ad_id"] = this.id;
        AdManager.containerPopup.setAttribute("data-ad-send", JSON.stringify(this.dataSend));        
        // Формирование содержимого popup.
        this.popupTitle.innerHTML = this.popupData.title;      
        const sendButton = this.#createSendButton(this.popupData.action.send);
        this.#createCancelButton()
        AdManager.containerPopup.classList.add("_active");
        // Отправка данных.
        sendButton.addEventListener("click", element => {
            element.preventDefault();
            AdManager.#sendPostData(this.csrfToken, this.serverHundler, this.dataSend)
                .then((data) => {
                    const button = this.#createCancelButton("Ok", this.popupMessages.querySelector(".popup__buttons_message"));
                    let title;
                    if( data.success ) {
                        title = this.popupData.action.message.success;
                        document.getElementById(this.id).remove();
                    } else {
                        title = this.popupData.action.message.error.replace("$inc", data.error);                    
                    }           
                    this.#createConfirmBlock(title);         
                    button.addEventListener("click", event => {
                        event.preventDefault();
                        this.#handlingPopupClosure();
                    });
                });
        });
    }
    // Формирование DOM отдельных элементов.
    #createSendButton(textButton, classButton = "popup__button popup__button--main", innerPlace = this.popupButtons ){
        const sendButton = document.createElement("a");
              sendButton.href  = "#";
              sendButton.className  = classButton                
              sendButton.id  = "adPopupSend";
              sendButton.innerHTML = textButton;
              innerPlace.prepend(sendButton);
        return sendButton;
    }
    #createCancelButton(title = "Cancel", innerPlace = this.popupButtons){
        const cancelButton = document.createElement("a");
            cancelButton.href  = "#";
            cancelButton.className  = "popup__button popup__button--addit _closePopup";
            cancelButton.innerHTML = title;
            innerPlace.append(cancelButton);
            cancelButton.addEventListener("click", event => {
                event.preventDefault();
                this.#handlingPopupClosure();
            });
        return cancelButton;
    }
    #createSelectContent(info){
        let selectHtml = document.createElement("select");
            selectHtml.className  = "popup__select";
            selectHtml.id  = "adPopupSelect";
        let currentList;
        const currentVal = this.getValueTypeArticle(this.id, this.articleType);    
        for (const key in info) {
            let optionSelect = document.createElement("option");
                optionSelect.value = key;
                optionSelect.innerHTML = info[key]["name"];
                optionSelect.setAttribute("data-ad-plane", info[key]["name"]);
            if (info[key]["name"].toLowerCase() === currentVal.toLowerCase()) {
                currentList = key;
                optionSelect.setAttribute("selected", "selected");
            }
            selectHtml.prepend(optionSelect);            
        }
        this.popupContent.prepend(selectHtml);
        this.popupContent.append(this.#createListContent(info, currentList));        
        return selectHtml;
    }
    #createListContent(info, key) {
        const infoList = info[key]["advantages"];
        let listHtml = document.createElement("ul");
            listHtml.className  = "popup__list";
        infoList.forEach( element => {
            let listItem = document.createElement("li");
                listItem.innerHTML = element;
                listHtml.append(listItem);
        });
        return listHtml;
    }
    #createPaymentContent(info){
        let paymentHtml = document.createElement("div");
            paymentHtml.className  = "popup__payment payment-block";
            paymentHtml.id  = "adPopupPayment";
        let paymentItemsHtml = document.createElement("div");
            paymentItemsHtml.className  = "payment-block__items";
            paymentHtml.prepend(paymentItemsHtml);
        info.amount.forEach( item => {
            let paymentItem = document.createElement("a");
                paymentItem.className = "payment-block__item";
                paymentItem.setAttribute("href", "#");
                paymentItem.innerHTML = "£" + item;
                paymentItem.setAttribute("data-ad-amount", item);
            paymentItemsHtml.prepend(paymentItem);
        });
        let paymentStripeHtml = document.createElement("div");
            paymentStripeHtml.className  = "payment-block__stripe";
            paymentHtml.append(paymentStripeHtml);
        let paymentInfoHtml = document.createElement("div");
            paymentInfoHtml.className  = "payment-block__info";
            paymentHtml.append(paymentInfoHtml);
        let paymentInfoText1 = document.createElement("span");
            paymentInfoText1.innerText  = "Secure payments are provided by Stripe";
        let paymentInfoText2 = document.createElement("span");
            paymentInfoText2.innerText  = "*Terms and Conditions apply";
            paymentInfoHtml.prepend(paymentInfoText1);
            paymentInfoHtml.append(paymentInfoText2);
        this.popupContent.prepend(paymentHtml);
        const itemSelector = ".payment-block__item";
        return itemSelector;
    }
    #createConfirmBlock(title){
        this.popupMessages.querySelector(".popup__title_message").innerHTML = title;
        this.popupMessages.classList.add("_active");
    }
    // AJAX
    static async #sendPostData(csrf, url = '', data = {},) {
        const response = await fetch(url, {
            method: 'POST',
            cache: 'no-cache', 
            credentials: "same-origin",
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrf
            },
            referrerPolicy: 'no-referrer',
            body: JSON.stringify(data)
        });
        return await response.json();
    } 
    // Получение типа записи/управления объявлением.
    getValueTypeArticle(id, type, string = "key") {
        const currentArticle = document.getElementById(id);
        const currentRow = currentArticle.querySelector(`[data-ad-type=${type}]`);
        const key = currentRow.getAttribute(this.attrName);
        if ( string === "key") return key;
        if ( string === "value") return  this.articleTextFields[key][1][1].toLowerCase(); 
    }
    // Получение противоположного текущему типа записи/управления объявлением (для отправки).
    getReverseValueTypeArticle(id, type, string = "key") {
        const currentArticle = document.getElementById(id);
        const currentRow = currentArticle.querySelector(`[data-ad-type=${type}]`);
        const allType = Object.keys(this.articleTextFields);
        for (const key of allType) {
            if (key !== currentRow.getAttribute(this.attrName) ) {
                if ( string === "key") return key;
                if ( string === "value") return  this.articleTextFields[key][0][1].toLowerCase();     
            }       
        }
    }
    // Установка атрибутов и текста в поля, управляющие объявлением.
    setTextFields(articleID = "", rowKey = "", data = this.articleTextFields, json = this.popupData) {
        if (data && Object.keys(data).length !== 0 && typeof data === "object") {
            // Установка значений указанной записи            
            if (articleID !== "" && rowKey !== "") {
                const article = document.getElementById(articleID);
                const row = article.querySelector(this.articleTypeSelector);
                if (data["path"]) {
                    const jsonContent = json[json.type]["data"];
                    row.setAttribute(this.attrName, jsonContent[rowKey]["name"]);
                    row.querySelector(data["path"]).innerHTML = jsonContent[rowKey]["name"].toUpperCase();
                } else {
                    row.setAttribute(this.attrName, rowKey);
                }
                for (const key in data) {
                    if (rowKey === key) {
                        let textArr = data[key];                            
                        textArr.forEach(items => {   
                            row.querySelector(items[0]).innerHTML = items[1];
                        });
                    }
                }
            }
            // Установка значений всех записей
            else {
                const rows = document.querySelectorAll(this.articleTypeSelector); 
                rows.forEach(row => {                    
                    const state = row.getAttribute(this.attrName);
                    for (const key in data) {                        
                        if (key === "path") {
                            row.querySelector(data[key]).innerHTML = state.toUpperCase();
                        }
                        if (state === key) {
                            let textArr = data[key];                            
                            textArr.forEach(items => {   
                                row.querySelector(items[0]).innerHTML = items[1];
                            });
                        }
                    }                    
                });
            }
        }
    }
}

function verifyAdPhoto(param) {
    const photoField = `
        <div class="section__adsItem-imageUpload" data-img-id="">
            <div class="section__adsItem-imageUpload_title">Please, verify this profile</div>
            <div class="section__adsItem-imageUpload_info">To verify your profile you have to upload a photo where you hold a piece of paper with your ID number (your ID <span class="section__adsItem-imageUpload_info-id">20267</span>) written on it. <a href="#">See the example</a></div>
            <div class="section__adsItem-imageUpload_buttons">
                <div class="section__adsItem-imageUpload_browserField">
                    <input type="file" id="browseAdImage" accept=".jpg,.jpeg,.png">
                    <button class="section__adsItem-imageUpload_button section__adsItem-imageUpload_browse">Browse</button>
                    <div class="section__adsItem-imageUpload_browseName"></div>
                </div>
                <button class="section__adsItem-imageUpload_button section__adsItem-imageUpload_upload" style="display: none;" disabled="true">Upload</button>
            </div>
            <div class="section__adsItem-imageUpload_preview"></div>
        </div>    
    `;
    const block = document.querySelector(".section__detailsBlock");
    let adID = "";


    const allVerifyAds = document.querySelectorAll("[data-ad-verify='unverified']");
    for (let index = 0; index < allVerifyAds.length; index++) {
        const element = allVerifyAds[index];
        const button = `<button class="section__adsItemRowBtn">Verify</button>`;
        element.insertAdjacentHTML(`beforeEnd`, button);
    }

    let file = [];

    block.addEventListener("click", actionHandler);    

    function actionHandler (event) {
        if (event.target.classList.contains("section__adsItemRowBtn")) {
            showBrowseField(event);
        }
        if (event.target.classList.contains("section__adsItem-imageUpload_browse")) {
            browserImage();
        }
        if (event.target.classList.contains("section__adsItem-imageUpload_upload")) {
            uploadImage();
        }
    }
    function showBrowseField (event) {
        const parent = event.target.closest(".section__bookmarkedItem");
        adID = parent.id;
        if (!document.querySelector(".section__adsItem-imageUpload")) {
            parent.insertAdjacentHTML(`afterEnd`, photoField);
        }
        document.querySelector(".section__adsItem-imageUpload").setAttribute("data-img-id", adID);
    }
    function changeHandler (event) {    
        if (!event.target.files.length) {
          return;
        }
        file = Array.from(event.target.files)[0];
        if (!file.type.match("image")) {
            return; 
        }
        changeStateButtons(false);
        const reader = new FileReader();
        
        reader.onload = (event) => {
            document.querySelector(".section__adsItem-imageUpload_preview").innerHTML = `
            <div class="section__adsItem-imageUpload_img" data-img-name="${file.name}">
                <img src="${event.target.result}" alt="${file.name}">
            </div>
            `;
          }
          document.getElementById("browseAdImage").value = "";
          reader.readAsDataURL(file);
          document.querySelector(".section__adsItem-imageUpload_browseName").innerText = file.name;
    }

    function browserImage () {
        const inputField = document.getElementById("browseAdImage");
        inputField.addEventListener("change", changeHandler);
        inputField.click();
    }

    function uploadImage (id) {
        const formData = new FormData();
        const headers = new Headers();
        console.log(adID);
        headers.append('X-CSRFToken', csrf_token);
        formData.append("id", adID);
        formData.append("image", file);        
        sendPhoto(uploadAdImage, headers, formData)
        .then(data => {        
            if (!data.error) {
                changeStateButtons();
                document.querySelector(".section__adsItem-imageUpload").remove();
                const currentAd = document.getElementById(adID);
                const currentRow = currentAd.querySelector("[data-ad-verify]");
                currentRow.setAttribute("data-ad-verify", "under_review");
                currentRow.querySelector(".section__adsItemRowState").innerText = "Under review";
                const button = currentRow.querySelector(".section__adsItemRowBtn");
                button.remove();
            } else {
                alert(data.error + " Please refresh the page");
            }        
        });
    }
    async function sendPhoto(url = '', headers, data) {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: data,
        });
        return await response.json();
    }
    function changeStateButtons (state = true) {
        const uploadButton = document.querySelector(".section__adsItem-imageUpload_upload");
        if (state) {
            uploadButton.style.display = "none";
            uploadButton.setAttribute("disabled", true);
        } else {
            uploadButton.style.display = "inline-flex";
            uploadButton.removeAttribute("disabled");
        }
    }
}
verifyAdPhoto();