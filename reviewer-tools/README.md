# Reviewer key tool

이 도구는 **각 리뷰어 본인 환경에서만** 실행한다. 운영자는 실행하지 않는다.

```powershell
npm --prefix ..\contract run build
node .\reviewer-tools\reviewer-key.mjs --name reviewer-1
```

출력의 `reviewerKey`만 운영자에게 전달한다. `secretFile`의 내용은 전달하지 않는다.
비밀키는 기본적으로 저장소 밖의
`%LOCALAPPDATA%\midnight-review\reviewers\<name>\reviewer-secret.hex`에 저장된다.

운영자는 전달받은 공개키 3개만 `deployment/reviewer-keys.json` 배열에 넣는다.
