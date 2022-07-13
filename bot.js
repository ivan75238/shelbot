const { Telegraf, Markup } = require('telegraf');
const {session} = require('telegraf');
const request = require("request");
const { parse } = require('node-html-parser');
const puppeteer = require('puppeteer');
const {get} = require('lodash');


const COMMANDS = {
    search: "Поиск",
    thnx: "Сказать спасибо",
    sales_get: "Мои скидки",
    sales_set: "Изменить скидки",
    labirint_set_sale: "labirint_set_sale",
};

const sessionData = {
    lastCommand:"",
    labirint_sale: 0
};

const keyboard = Markup.keyboard([
        [COMMANDS.sales_get, COMMANDS.sales_set]
    ]).resize();

const keyboardSetSale = Markup.inlineKeyboard([
    Markup.button.callback('Лабиринт', COMMANDS.labirint_set_sale),
]).resize();

const bot = new Telegraf("5023146736:AAHCCdIw3s0iVfBbXJEjBsCqeW1MulvHdZw");

bot.use(session());

bot.start((ctx) => {
    ctx.session = sessionData;
    ctx.reply(`Привет ${ctx.from.first_name}, я Шелбот! И я готов помочь тебе найти твою любимую книжечку в магазинах!`, {
        reply_markup: {
            keyboard: [
                [
                    {text: COMMANDS.search},
                    {text: COMMANDS.thnx}
                ]
            ],
            resize_keyboard: true
        }})
});

bot.action('labirint_set_sale', (ctx) => {
    ctx.session.lastCommand = COMMANDS.labirint_set_sale;
    ctx.replyWithHTML(`Введите процент вашей персональной скидки`);
});

bot.on('text', async ctx =>  {
    if (!ctx.session) {
        ctx.session = sessionData;
        ctx.session.lastCommand = COMMANDS.search;
    }

    switch (ctx.message.text) {
        case COMMANDS.thnx:
            ctx.reply('И тебе спасибо, зный - ты красавчик =)', keyboard);
            break;
        case COMMANDS.sales_get:
            ctx.replyWithHTML(`Скидка в Лабиринте: <b>${ctx.session.labirint_sale}</b>%`);
            break;
        case COMMANDS.sales_set:
            ctx.replyWithHTML(`Выбери магазин, чью скидку будем менять`, keyboardSetSale);
            break;
        case COMMANDS.search:
            ctx.session.lastCommand = COMMANDS.search;
            ctx.reply('Отлично, введи поисковый запрос в виде: Фамилия автора-Название', keyboard);
            break;
        default:
            switch (ctx.session.lastCommand) {
                case COMMANDS.labirint_set_sale:
                    ctx.session.lastCommand = COMMANDS.search;
                    ctx.session.labirint_sale = ctx.message.text;
                    ctx.reply('Отлично, скидка изменена');
                    break;
                case undefined:
                case null:
                case "":
                case COMMANDS.search:
                    //Ищем в читай городе
                    await searchLabirint(ctx);
                    await searchProdalit(ctx);
                    await searchOzon(ctx);
                    await searchWildberries(ctx);
                    await searchChitaiGorod(ctx);
                    break;
                default:
                    ctx.reply("Погоди! Сначала укажи комманду!", keyboard);
                    break;
            }
            break;
    }
});

bot.launch(); // запуск бота

//region ChitaiGorod Methods

const searchChitaiGorod = async (ctx) => {
    try {
        const responseChitaiGorod = await getBookChitaiGorod(ctx.message.text);
        if (responseChitaiGorod) {
            if (responseChitaiGorod.ids.length === 0) {
                ctx.replyWithHTML("<b>Читай город</b>: Ничего не найдено");
                return;
            }
            const responseChitaiGorodBook = await getBooksChitaiGorod(responseChitaiGorod.ids);
            if (responseChitaiGorodBook && responseChitaiGorodBook.result) {
                let books = Object.values(responseChitaiGorodBook.result).filter(book => book.quantity);
                let booksShow, booksOtherlength;
                if (books.length > 15) {
                    booksShow = books.slice(0, 15);
                    booksOtherlength = books.slice(15).length;
                } else {
                    booksShow = books;
                }
                await ctx.replyWithHTML(`<b>Читай город</b>: ${!books.length ? "Ничего не найдено" : `Найдено: ${books.length} шт.`}\n${!books.length ? "" : `${booksShow.map(book => `[${book.publisher}] ${book.author} ${book.name} - <b>${book.price}₽</b> <a href="https://www.chitai-gorod.ru${book.link}">ссылка</a>`).join("\n")}`}${booksOtherlength ? `\nИ еще ${booksOtherlength} <a href="https://www.chitai-gorod.ru/search/result/?q=${encodeURIComponent(ctx.message.text)}&page=1">результатов</a>` : ""}`,
                    {
                        disable_web_page_preview: true
                    });
            } else {
                ctx.replyWithHTML("<b>Читай город</b>: Ошибка получения подробностей. Попробуйте позже");
            }
        } else {
            ctx.replyWithHTML("<b>Читай город</b>: Ошибка поиска. Попробуйте позже");
        }
    }
    catch (e) {
        console.log("ОШИБКА ЧИТАЙ ГОРОД", e);
        ctx.replyWithHTML("<b>Читай город</b>: Ошибка поиска. Попробуйте позже");
    }
};

const getBookChitaiGorod = async str => {
    const options = {
        method: 'POST',
        url: 'https://search-v2.chitai-gorod.ru/api/v3/search/',
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            "cookie": "reese84=3:+RkGCp2GZkRO+G9ajjQVMw==:2hBL8W9+ohMaSXU4DPoxv3XBXaMCaTsmWiULwphcBuhQVtXpybWUNpCdu/RY3BwJgsHm7wIRjtbiAjUPGj+B1iQ4YrHp4kXRr9h2uZuNw5MZXnqPnPWicxXmusfi5PJI3XCsGeTIlMbi7PwLdh80xzYuLACiqEHN4oTPCtwE4isTwBc6pY/RDZpC+j/nDxKpJEL2ARf7qD6Hja9aF8B1uRPiLOMOdAM1lY31C21oY07U0C7ejL7jYGmXkmkNLy0h9ZUe6l9kGAyuTHOsD4QSYjutbqWTG1rKUHWHUHUK8lnircTDJEP7uCYZFdvZqMlFfZ1UbijuoN1ZJTSpj/Y1CxUFo8lgawDdivsZS6k/ttPLtbN58UKIRvAr7/PBO9piNg4WAaSMtZbtpJNX3DaGaRI1iBv06ODqrcAW3nhaeYs=:lt2OEFUp2KICMK1kStiTzUdMR0bE4w3lDHLMwi2Rh5A=",
        },
        form: {
            query: str,
            index: 'goods',
            type: 'common',
            per_page: '100'
        }
    };

    const response = await requestPost(options);
    if (response.isError)
        return null;

    return JSON.parse(response.body);
};

const getBooksChitaiGorod = async ids => {
    const options = {
        method: 'POST',
        url: 'https://webapi.chitai-gorod.ru/web/goods/extension/list/',
        headers: {
            "accept": "*/*",
            "accept-language": "ru,en-US;q=0.9,en;q=0.8,ru-RU;q=0.7,vi;q=0.6,my;q=0.5",
            "content-type": "application/x-www-form-urlencoded",
            "sec-ch-ua": "\" Not A;Brand\";v=\"99\", \"Chromium\";v=\"96\", \"Google Chrome\";v=\"96\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"Windows\"",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-site",
            "cookie": "reese84=3:+RkGCp2GZkRO+G9ajjQVMw==:2hBL8W9+ohMaSXU4DPoxv3XBXaMCaTsmWiULwphcBuhQVtXpybWUNpCdu/RY3BwJgsHm7wIRjtbiAjUPGj+B1iQ4YrHp4kXRr9h2uZuNw5MZXnqPnPWicxXmusfi5PJI3XCsGeTIlMbi7PwLdh80xzYuLACiqEHN4oTPCtwE4isTwBc6pY/RDZpC+j/nDxKpJEL2ARf7qD6Hja9aF8B1uRPiLOMOdAM1lY31C21oY07U0C7ejL7jYGmXkmkNLy0h9ZUe6l9kGAyuTHOsD4QSYjutbqWTG1rKUHWHUHUK8lnircTDJEP7uCYZFdvZqMlFfZ1UbijuoN1ZJTSpj/Y1CxUFo8lgawDdivsZS6k/ttPLtbN58UKIRvAr7/PBO9piNg4WAaSMtZbtpJNX3DaGaRI1iBv06ODqrcAW3nhaeYs=:lt2OEFUp2KICMK1kStiTzUdMR0bE4w3lDHLMwi2Rh5A=",
            "Referrer-Policy": "no-referrer-when-downgrade"
        },
        body: `token=123&action=read&data%5B%5D=${ids.join("&data%5B%5D=")}`,
    };
    const response = await requestPost(options);
    if (response.isError)
        return null;

    return JSON.parse(response.body);
};
//endregion

//region Labirint
const searchLabirint = async ctx => {
    try {
        const options = {
            method: 'POST',
            url: `https://www.labirint.ru/search/${encodeURIComponent(ctx.message.text)}/?stype=0`
        };

        const response = await requestPost(options);

        if (response.isError)
            return null;

        const root = parse(response.body);
        let books = [];
        root.querySelectorAll('.card-column').map((card, i) => {
            card.childNodes.map((item, j) => {
                if (item.rawAttrs) {
                    const dataArrayString = item.rawAttrs
                        .replace(/\r\n/g, '')
                        .replace(/"/g, '')
                        .split('data-');
                    const data = {};
                    dataArrayString.map(str => {
                        const pair = str.split("=");
                        data[pair[0]] = pair[1];
                    });
                    books.push(data);
                }
            });
        });
        books = books.filter(book => book.name && book["available-status"] !== '0');
        let booksShow, booksOtherlength;
        if (books.length > 15) {
            booksShow = books.slice(0, 15);
            booksOtherlength = books.slice(15).length;
        }
        else {
            booksShow = books;
        }

        await ctx.replyWithHTML(`<b>Лабиринт</b>: ${!books.length ? "Ничего не найдено" : `Найдено: ${books.length} шт.`}\n${!books.length ? "" : `${booksShow.map(book => `[${book.pubhouse}] ${book.name} - <b>${parseFloat(book['discount-price']) - (parseFloat(book['discount-price']) * ctx.session.labirint_sale / 100)}₽</b> <a href="https://www.labirint.ru/books/${book['product-id']}/">ссылка</a>`).join("\n")}`}${booksOtherlength ? `\nИ еще ${booksOtherlength} <a href="https://www.labirint.ru/search/${encodeURIComponent(ctx.message.text)}/?stype=0">результатов</a>` : ""}`,
            {
                disable_web_page_preview: true
            });
    }
    catch (e) {
        console.log("ОШИБКА ЛАБИРИНТ", e);
        ctx.replyWithHTML("<b>Лабиринт</b>: Ошибка поиска. Попробуйте позже");
    }
};
//endregion

//region Prodalit
const searchProdalit = async ctx => {
    try {
        const options = {
            method: 'GET',
            url: `https://www.prodalit.ru/Products/ProductsSearch?SearchText=${encodeURIComponent(ctx.message.text)}`
        };
        const response = await requestPost(options);

        if (response.isError)
            return null;

        const data = JSON.parse(response.body);
        const books = data.Products;
        let booksShow, booksOtherlength;
        if (books.length > 15) {
            booksShow = books.slice(0, 15);
            booksOtherlength = books.slice(15).length;
        }
        else {
            booksShow = books;
        }

        await ctx.replyWithHTML(`<b>Продалит</b>: ${!books.length ? "Ничего не найдено" : `Найдено: ${books.length} шт.`}\n${!books.length ? "" : `${booksShow.map(book => `[${book.Publisher}${book.Brand && `-${book.Brand}`}] ${book.Author} ${book.ProductName} - <b>${book.CostAction || book.Cost}₽</b> <a href="https://www.prodalit.ru${book.Url}">ссылка</a>`).join("\n")}`}${booksOtherlength ? `\nИ еще ${booksOtherlength} <a href="https://www.prodalit.ru/cat?FindMode=Short&SearchText=${encodeURIComponent(ctx.message.text)}">результатов</a>` : ""}`,
            {
                disable_web_page_preview: true
            });
    }
    catch (e) {
        console.log("ОШИБКА ПРОДАЛИТ", e);
        ctx.replyWithHTML("<b>Продалит</b>: Ошибка поиска. Попробуйте позже");
    }
};
//endregion

//region Ozon
const searchOzon = async ctx => {
    try {
        return puppeteer
            .launch()
            .then(browser => browser.newPage())
            .then(page => page.goto(`https://www.ozon.ru/category/knigi-16500/?from_global=true&text=${encodeURIComponent(ctx.message.text)}`).then(() => page.content()))
            .then(async html => {
                const root = parse(html);
                let books = [];
                root.querySelectorAll('.bh6').map((card, i) => {
                    let price, name, url;
                    const cardHTMLElements = card.childNodes.filter(i => i.childNodes.length);
                    const containerInfo = cardHTMLElements[1];
                    //Получаем цену
                    const containerPrice = get(containerInfo, "childNodes.0.childNodes.0");
                    if (containerPrice) {
                        price = get(containerPrice, "childNodes.0._rawText");
                    }
                    //Получаем наименование
                    const containerNameLink = containerInfo.childNodes.find(j => j.rawTagName === "a");
                    if (containerNameLink) {
                        url = get(containerNameLink, "_attrs.href");
                        name = get(containerNameLink, "childNodes.0.childNodes.0.childNodes.0._rawText")
                    }
                    if (price && name && url) {
                        books.push({price, name, url});
                    }
                });
                let booksShow, booksOtherlength;
                if (books.length > 15) {
                    booksShow = books.slice(0, 15);
                    booksOtherlength = books.slice(15).length;
                }
                else {
                    booksShow = books;
                }
                await ctx.replyWithHTML(`<b>Ozon</b>: ${!books.length ? "Ничего не найдено" : `Найдено: ${books.length} шт.`}\n${!books.length ? "" : `${booksShow.map(book => `${book.name} - <b>${book.price}</b> <a href="https://www.ozon.ru${book.url}/">ссылка</a>`).join("\n")}`}${booksOtherlength ? `\nИ еще ${booksOtherlength} <a href="https://www.ozon.ru/category/knigi-16500/?from_global=true&text=${encodeURIComponent(ctx.message.text)}">результатов</a>` : ""}`,
                    {
                        disable_web_page_preview: true
                    });
            });
    }
    catch (e) {
        console.log("ОШИБКА OZON", e);
        ctx.replyWithHTML("<b>Ozon</b>: Ошибка поиска. Попробуйте позже");
    }
};
//endregion

//region Wildberries
const searchWildberries = async ctx => {
    try {
        const options = {
            "headers": {
                "accept": "*/*",
                "accept-language": "ru,en-US;q=0.9,en;q=0.8,ru-RU;q=0.7,vi;q=0.6,my;q=0.5",
                "sec-ch-ua": "\" Not A;Brand\";v=\"99\", \"Chromium\";v=\"96\", \"Google Chrome\";v=\"96\"",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": "\"Windows\"",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
                "x-requested-with": "XMLHttpRequest",
                "cookie": "___wbu=db64ff47-d832-4bf2-8ba3-fa15bb4de20b.1630979997; _wbauid=3391955641630979997; _ga=GA1.2.1662116453.1630979998; route=1639107741.522.25746.543084|6d6164c496b4d44357690e6a7d65d486; __wbl=cityId%3D4423%26regionId%3D38%26city%3D%D0%98%D1%80%D0%BA%D1%83%D1%82%D1%81%D0%BA%26phone%3D88001007505%26latitude%3D52%2C275261%26longitude%3D104%2C30864%26src%3D1; __store=6147_1193_686_1733_117501_507_3158_120762_117986; __region=64_58_83_4_38_30_33_70_22_31_66_40_82_1_80_68_48_69; __pricemargin=1.0--; __cpns=2_12_6_7_3_21_16; __sppfix=; __dst=-1221148_-145454_-1430613_-5827642; BasketUID=cfa0fb4e-f53f-494a-a7b5-0fdc27b6f48d; ___wbs=8ea09f00-07a6-4fc5-8557-c40afc0473d5.1639107744; _gcl_aw=GCL.1639107742.CjwKCAiA78aNBhAlEiwA7B76p7aNgTaInqxEYKJdxsnc0QkH8NSgibSXo06IYj950o9EIy9AIVTtdxoCqEsQAvD_BwE; _gcl_au=1.1.1132338412.1639107742; _gid=GA1.2.439334119.1639107742; _gac_UA-2093267-1=1.1639107742.CjwKCAiA78aNBhAlEiwA7B76p7aNgTaInqxEYKJdxsnc0QkH8NSgibSXo06IYj950o9EIy9AIVTtdxoCqEsQAvD_BwE; criteo_uid=Qufslj3OPgZsyj0QUYyPWLz0TuVpwdyr; _pk_ref.1.034e=%5B%22%22%2C%22%22%2C1639107742%2C%22https%3A%2F%2Fwww.google.com%2F%22%5D; _pk_ses.1.034e=*; __catalogOptions=CardSize%3AC516x688%26Sort%3APopular; ncache=6147_1193_686_1733_117501_507_3158_120762_117986%3B64_58_83_4_38_30_33_70_22_31_66_40_82_1_80_68_48_69%3B1.0--%3B2_12_6_7_3_21_16%3B%3BCardSize%3AC516x688%26Sort%3APopular%3B-1221148_-145454_-1430613_-5827642; __tm=1639119294; _dc_gtm_UA-2093267-1=1; _pk_id.1.034e=12bdc09a54f5657b.1630979998.12.1639108605.1639107742.",
                "Referer": `https://www.wildberries.ru/catalog/0/search.aspx?search=${encodeURIComponent(ctx.message.text)}`,
                "Referrer-Policy": "no-referrer-when-downgrade"
            },
            "body": null,
            "method": "POST",
            url: `https://www.wildberries.ru/user/get-xinfo-v2`
        };
        const response = await requestPost(options);

        if (response.isError)
            return null;
        const xinfo = JSON.parse(response.body).xinfo;


        const options1 = {
            "headers": {
                "accept": "*/*",
                "accept-language": "ru,en-US;q=0.9,en;q=0.8,ru-RU;q=0.7,vi;q=0.6,my;q=0.5",
                "sec-ch-ua": "\" Not A;Brand\";v=\"99\", \"Chromium\";v=\"96\", \"Google Chrome\";v=\"96\"",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": "\"Windows\"",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-site"
            },
            "referrer": `https://www.wildberries.ru/catalog/0/search.aspx?search=${encodeURIComponent(ctx.message.text)}`,
            "referrerPolicy": "no-referrer-when-downgrade",
            "body": null,
            "method": "GET",
            "mode": "cors",
            "credentials": "omit",
            url: `https://wbxsearch.wildberries.ru/exactmatch/v2/common?query=${encodeURIComponent(ctx.message.text)}`
        };
        const response1 = await requestPost(options1);
        if (response1.isError)
            return null;
        const query = JSON.parse(response1.body).query;


        const options2 = {
            "headers": {
                "accept": "*/*",
                "accept-language": "ru,en-US;q=0.9,en;q=0.8,ru-RU;q=0.7,vi;q=0.6,my;q=0.5",
                "sec-ch-ua": "\" Not A;Brand\";v=\"99\", \"Chromium\";v=\"96\", \"Google Chrome\";v=\"96\"",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": "\"Windows\"",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-site"
            },
            "body": null,
            "referrer": `https://www.wildberries.ru/catalog/0/search.aspx?search=${encodeURIComponent(ctx.message.text)}`,
            "referrerPolicy": "no-referrer-when-downgrade",
            "mode": "cors",
            "credentials": "omit",
            "method": "GET",
            url: `https://wbxcatalog-ru.wildberries.ru/merger/catalog?${xinfo}&${query}`
        };
        const response2 = await requestPost(options2);
        if (response2.isError)
            return null;

        const data = JSON.parse(response2.body);
        const books = data.data.products;
        let booksShow, booksOtherlength;
        if (books.length > 15) {
            booksShow = books.slice(0, 15);
            booksOtherlength = books.slice(15).length;
        }
        else {
            booksShow = books;
        }
        await ctx.replyWithHTML(`<b>Wildberries</b>: ${!books.length ? "Ничего не найдено" : `Найдено: ${books.length} шт.`}\n${!books.length ? "" : `${booksShow.map(book => `[${book.brand}] ${book.name} - <b>${book.salePriceU ? parseInt(book.salePriceU)/100 : parseInt(book.priceU)/100}₽</b> <a href="https://www.wildberries.ru/catalog/${book.id}/detail.aspx?targetUrl=XS">ссылка</a>`).join("\n")}`}${booksOtherlength ? `\nИ еще ${booksOtherlength} <a href="https://www.wildberries.ru/catalog/0/search.aspx?search=${encodeURIComponent(ctx.message.text)}">результатов</a>` : ""}`,
            {
                disable_web_page_preview: true
            });
    }
    catch (e) {
        console.log("ОШИБКА WILDBERRIES", e);
        ctx.replyWithHTML("<b>Wildberries</b>: Ошибка поиска. Попробуйте позже");
    }
};
//endregion

const requestPost = (options) => {
    return new Promise(function (resolve) {
        request(options, function (error, res, body) {
            if (!error && res.statusCode == 200) {
                resolve({isError: false, body});
            } else {
                resolve({isError: true, error});
            }
        });
    });
};