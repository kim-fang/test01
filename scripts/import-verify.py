from pathlib import Path
import os
from playwright.sync_api import sync_playwright


PROJECT_ROOT = Path(r"C:\Users\Lenovo\Documents\New project 2")
EXCEL_PATH = Path(r"C:\Users\Lenovo\Desktop\daoru.xlsx")
APP_URL = os.environ.get("APP_URL", "http://127.0.0.1:3025")
EXPECTED_NAME = "rrrrr1"
EXPECTED_SUCCESS = "导入成功，共导入 1 条网点记录。"


def main() -> None:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1600, "height": 1000})
        page.on("console", lambda message: print("CONSOLE:", message.type, message.text))
        page.on("response", lambda response: print("RESPONSE:", response.status, response.url))

        before_response = page.request.get(f"{APP_URL}/api/messages")
        before_payload = before_response.json()
        before_count = sum(
            1 for item in before_payload["data"] if item["name"] == EXPECTED_NAME
        )
        print(f"COUNT_BEFORE={before_count}")

        page.goto(APP_URL, wait_until="domcontentloaded", timeout=120000)
        page.get_by_role("button", name="导入 Excel").wait_for(timeout=120000)

        file_input = page.locator('input[type="file"]')
        with page.expect_response(
            lambda response: response.request.method == "POST"
            and "/api/messages/import" in response.url
        ) as import_response_info:
            file_input.set_input_files(str(EXCEL_PATH))

        import_response = import_response_info.value
        print("IMPORT_STATUS=", import_response.status)
        print("IMPORT_BODY=", import_response.text())

        page.get_by_text(EXPECTED_SUCCESS).wait_for(timeout=120000)
        page.get_by_text(EXPECTED_NAME).first.wait_for(timeout=120000)

        after_response = page.request.get(f"{APP_URL}/api/messages")
        after_payload = after_response.json()
        after_count = sum(
            1 for item in after_payload["data"] if item["name"] == EXPECTED_NAME
        )
        print(f"COUNT_AFTER={after_count}")

        if after_count != before_count + 1:
            raise RuntimeError(
                f"Import verification failed: expected {before_count + 1}, got {after_count}"
            )

        page.screenshot(path=str(PROJECT_ROOT / "import-verify.png"), full_page=True)
        print("IMPORT_VERIFIED=1")

        browser.close()


if __name__ == "__main__":
    main()
